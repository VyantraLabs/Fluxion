import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTemplatePathsAndCategories1757710000000 implements MigrationInterface {
  name = 'FixTemplatePathsAndCategories1757710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Fixing template paths and category mappings...');

    // Step 1: Fix template paths to comply with check constraint (must start with 'templates/')
    console.log('📁 Updating template S3 paths to comply with constraint and match file structure...');
    
    // The constraint requires paths to start with "templates/" so we need to keep that prefix
    // but fix the structure to match actual files
    const pathUpdates = [
      { old: 'templates/system/contracts/', new: 'templates/contracts/' },
      { old: 'templates/system/estimates/', new: 'templates/estimates/' },
      { old: 'templates/system/invoices/', new: 'templates/invoices/' },
      { old: 'templates/system/receipts/', new: 'templates/receipts/' },
      { old: 'templates/system/proposals/', new: 'templates/proposals/' },
      { old: 'templates/system/reports/', new: 'templates/reports/' },
    ];

    for (const update of pathUpdates) {
      await queryRunner.query(`
        UPDATE templates 
        SET s3_template_url = REPLACE(s3_template_url, '${update.old}', '${update.new}')
        WHERE s3_template_url LIKE '%${update.old}%'
        AND organization_id = '010000000000000000000000'
      `);
    }

    // Step 2: Fix category mappings - templates got assigned to wrong categories during the consolidation
    console.log('📂 Fixing template category assignments...');

    // Get category IDs for proper mapping
    const categories = await queryRunner.query(`
      SELECT id, slug FROM template_categories
    `);

    const categoryMap: { [key: string]: string } = {};
    categories.forEach((cat: any) => {
      categoryMap[cat.slug] = cat.id;
    });

    console.log('📋 Category mappings:', categoryMap);

    // Fix Invoice templates (currently in wrong categories)
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = '${categoryMap['invoices']}'
      WHERE name LIKE '%Invoice%' 
      AND organization_id = '010000000000000000000000'
    `);

    // Fix Contract templates
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = '${categoryMap['contracts']}'
      WHERE name LIKE '%Contract%' OR name LIKE '%Agreement%'
      AND organization_id = '010000000000000000000000'
    `);

    // Fix Estimate/Quote templates
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = '${categoryMap['estimates']}'
      WHERE (name LIKE '%Estimate%' OR name LIKE '%Quote%')
      AND organization_id = '010000000000000000000000'
    `);

    // Fix Receipt templates (currently in Payslips category)
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = '${categoryMap['receipts']}'
      WHERE name LIKE '%Receipt%'
      AND organization_id = '010000000000000000000000'
    `);

    // Fix Proposal templates (already correctly assigned)
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = '${categoryMap['proposals']}'
      WHERE name LIKE '%Proposal%'
      AND organization_id = '010000000000000000000000'
    `);

    // Fix Report templates (currently in Contracts category)
    await queryRunner.query(`
      UPDATE templates 
      SET category_id = '${categoryMap['contracts']}'
      WHERE name LIKE '%Report%'
      AND organization_id = '010000000000000000000000'
    `);

    // Step 3: Remove templates that don't have corresponding files or create missing templates
    console.log('🧹 Cleaning up templates without corresponding files...');

    // List of templates that should exist based on actual files
    const validTemplates = [
      // Invoices
      { name: 'Consulting Services Invoice Template', path: 'templates/invoices/consulting-services.html', category: 'invoices' },
      { name: 'Creative Agency Invoice Template', path: 'templates/invoices/creative-agency.html', category: 'invoices' },
      { name: 'Modern Minimalist Invoice Template', path: 'templates/invoices/modern-minimalist.html', category: 'invoices' },
      { name: 'Professional Business Invoice Template', path: 'templates/invoices/professional-business.html', category: 'invoices' },
      { name: 'Tech Startup Invoice Template', path: 'templates/invoices/tech-startup.html', category: 'invoices' },
      
      // Contracts
      { name: 'Freelance Contract Template', path: 'templates/contracts/freelance-contract.html', category: 'contracts' },
      { name: 'Service Agreement Template', path: 'templates/contracts/service-agreement.html', category: 'contracts' },
      
      // Estimates  
      { name: 'Detailed Project Estimate Template', path: 'templates/estimates/detailed-project.html', category: 'estimates' },
      { name: 'Quick Service Quote Template', path: 'templates/estimates/quick-service-quote.html', category: 'estimates' },
      
      // Receipts
      { name: 'Crypto Payment Receipt Template', path: 'templates/receipts/crypto-payment.html', category: 'receipts' },
      { name: 'Service Payment Receipt Template', path: 'templates/receipts/service-payment.html', category: 'receipts' },
      
      // Proposals
      { name: 'Business Proposal Template', path: 'templates/proposals/business-proposal.html', category: 'proposals' },
      { name: 'Creative Project Proposal Template', path: 'templates/proposals/creative-project.html', category: 'proposals' },
      
      // Reports
      { name: 'Financial Summary Report Template', path: 'templates/reports/financial-summary.html', category: 'contracts' },
      { name: 'Monthly Progress Report Template', path: 'templates/reports/monthly-progress.html', category: 'contracts' },
    ];

    // Update existing templates with correct paths and categories
    for (const template of validTemplates) {
      const categoryId = categoryMap[template.category];
      await queryRunner.query(`
        UPDATE templates 
        SET s3_template_url = '${template.path}',
            category_id = '${categoryId}'
        WHERE name = '${template.name}'
        AND organization_id = '010000000000000000000000'
      `);
      console.log(`  ✅ Updated: ${template.name}`);
    }

    console.log('✅ Template paths and categories fixed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Reverting template path and category fixes...');

    // Revert path changes
    const pathReverts = [
      { new: 'templates/system/contracts/', old: 'contracts/' },
      { new: 'templates/system/estimates/', old: 'estimates/' },
      { new: 'templates/system/invoices/', old: 'invoices/' },
      { new: 'templates/system/receipts/', old: 'receipts/' },
      { new: 'templates/system/proposals/', old: 'proposals/' },
      { new: 'templates/system/reports/', old: 'reports/' },
    ];

    for (const revert of pathReverts) {
      await queryRunner.query(`
        UPDATE templates 
        SET s3_template_url = REPLACE(s3_template_url, '${revert.old}', '${revert.new}')
        WHERE s3_template_url LIKE '%${revert.old}%'
        AND organization_id = '010000000000000000000000'
      `);
    }

    console.log('⚠️  Note: Category mappings cannot be automatically reverted');
  }
}