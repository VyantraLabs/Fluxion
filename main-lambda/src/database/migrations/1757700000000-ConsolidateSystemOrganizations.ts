import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidateSystemOrganizations1757700000000 implements MigrationInterface {
  name = 'ConsolidateSystemOrganizations1757700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting system organization consolidation...');

    // Step 1: First, move all references from the duplicate ULID organization to the UUID one
    console.log('📝 Moving references from duplicate ULID organization to UUID organization...');
    
    // Update templates from duplicate ULID org to UUID org temporarily
    await queryRunner.query(`
      UPDATE templates 
      SET organization_id = '00000000-0000-0000-0000-000000000000'
      WHERE organization_id = '010000000000000000000000'
    `);

    // Update other tables if they have references to the ULID org
    const tables = ['users', 'invoices', 'payments', 'audit_logs', 'organization_settings', 'notification_queue', 'notification_settings'];
    
    for (const table of tables) {
      try {
        await queryRunner.query(`
          UPDATE ${table}
          SET organization_id = '00000000-0000-0000-0000-000000000000'
          WHERE organization_id = '010000000000000000000000'
        `);
      } catch (error) {
        console.log(`⚠️  Table ${table} doesn't exist or no references found, skipping...`);
      }
    }

    // Try reminder_jobs if it exists
    try {
      await queryRunner.query(`
        UPDATE reminder_jobs
        SET organization_id = '00000000-0000-0000-0000-000000000000'
        WHERE organization_id = '010000000000000000000000'
      `);
    } catch (error) {
      console.log('⚠️  reminder_jobs table not found, skipping...');
    }

    // Step 2: Remove the duplicate ULID organization
    console.log('🗑️  Removing duplicate ULID organization...');
    await queryRunner.query(`
      DELETE FROM organizations 
      WHERE id = '010000000000000000000000'
    `);

    // Step 3: Create a new system organization with the desired ULID ID
    console.log('➕ Creating new system organization with ULID...');
    await queryRunner.query(`
      INSERT INTO organizations (id, name, slug, plan, settings, created_at, updated_at)
      VALUES (
        '010000000000000000000000',
        'System Templates',
        'system',
        'enterprise',
        '{}',
        NOW(),
        NOW()
      )
    `);

    // Step 4: Update all references from UUID org to the new ULID org
    console.log('📝 Updating all references to use new ULID organization...');

    // Update all tables to point to the new ULID organization
    for (const table of tables) {
      try {
        await queryRunner.query(`
          UPDATE ${table}
          SET organization_id = '010000000000000000000000'
          WHERE organization_id = '00000000-0000-0000-0000-000000000000'
        `);
        console.log(`  ✅ Updated ${table}`);
      } catch (error: any) {
        console.log(`  ⚠️  Error updating ${table}: ${error.message}`);
      }
    }

    // Update templates table
    await queryRunner.query(`
      UPDATE templates 
      SET organization_id = '010000000000000000000000'
      WHERE organization_id = '00000000-0000-0000-0000-000000000000'
    `);

    // Update reminder_jobs table if it exists
    try {
      await queryRunner.query(`
        UPDATE reminder_jobs 
        SET organization_id = '010000000000000000000000'
        WHERE organization_id = '00000000-0000-0000-0000-000000000000'
      `);
      console.log('  ✅ Updated reminder_jobs');
    } catch (error) {
      console.log('  ⚠️  reminder_jobs table not found, skipping...');
    }

    // Step 5: Remove the old UUID organization
    console.log('🗑️  Removing old UUID organization...');
    await queryRunner.query(`
      DELETE FROM organizations 
      WHERE id = '00000000-0000-0000-0000-000000000000'
    `);

    // Step 6: Update all orphaned templates to reference the system organization
    console.log('🔗 Updating orphaned templates...');
    await queryRunner.query(`
      UPDATE templates 
      SET organization_id = '010000000000000000000000'
      WHERE organization_id IS NULL
    `);

    // Step 7: Clean up category mappings - Fix incorrect categories
    console.log('📂 Fixing template categories...');

    // The categories already exist correctly, but we need to add the missing "Proposals" category
    // First, check if Proposals category exists, if not create it
    const proposalsCategory = await queryRunner.query(`
      SELECT id FROM template_categories WHERE slug = 'proposals'
    `);

    if (proposalsCategory.length === 0) {
      // Create Proposals category
      await queryRunner.query(`
        INSERT INTO template_categories (id, name, slug, description, sort_order, is_system, is_active, created_at, updated_at)
        VALUES (
          '01HZ0000000000000000000007',
          'Proposals',
          'proposals', 
          'Business and project proposal templates',
          7,
          true,
          true,
          NOW(),
          NOW()
        )
      `);
      console.log('  ✅ Created Proposals category');
    }

    // Update templates that should be in Proposals category but are in Receipts
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = (SELECT id FROM template_categories WHERE slug = 'proposals')
      WHERE name LIKE '%Proposal%' AND category_id = '01HZ0000000000000000000004'
    `);

    // Step 8: Remove redundant system templates with duplicate names/functionality
    console.log('🧹 Removing redundant templates...');

    // Remove all templates with null organization_id (these are old templates without S3 URLs)
    const deletedCount = await queryRunner.query(`
      DELETE FROM templates 
      WHERE organization_id IS NULL OR s3_template_url IS NULL
      RETURNING id
    `);
    console.log(`  🗑️  Removed ${deletedCount.length} redundant templates`);

    // Step 9: Update template paths to ensure consistency
    console.log('🔧 Updating template S3 paths...');
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/system/', 'templates/system/')
      WHERE s3_template_url LIKE '%templates/system/%' 
      AND organization_id = '010000000000000000000000'
    `);

    console.log('✅ System organization consolidation completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Reverting system organization consolidation...');

    // This is a complex migration to revert, but we'll do our best
    // Revert the organization ID back to UUID format
    await queryRunner.query(`
      UPDATE organizations 
      SET 
        id = '00000000-0000-0000-0000-000000000000',
        name = 'Default Organization',
        slug = 'default'
      WHERE id = '010000000000000000000000'
    `);

    // Revert all foreign key references
    const tables = [
      'users',
      'invoices', 
      'payments',
      'audit_logs',
      'organization_settings',
      'notification_queue',
      'notification_settings',
      'templates'
    ];

    for (const table of tables) {
      try {
        await queryRunner.query(`
          UPDATE ${table}
          SET organization_id = '00000000-0000-0000-0000-000000000000'
          WHERE organization_id = '010000000000000000000000'
        `);
      } catch (error: any) {
        console.log(`⚠️  Warning reverting ${table}: ${error.message}`);
      }
    }

    // Try to revert reminder_jobs if it exists
    try {
      await queryRunner.query(`
        UPDATE reminder_jobs
        SET organization_id = '00000000-0000-0000-0000-000000000000'
        WHERE organization_id = '010000000000000000000000'
      `);
    } catch (error) {
      console.log('⚠️  reminder_jobs table not found during revert, skipping...');
    }

    console.log('⚠️  Note: Template cleanup and category fixes cannot be fully reverted automatically');
  }
}