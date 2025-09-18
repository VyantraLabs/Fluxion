import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class RefactorTemplateSystem1757500000000 implements MigrationInterface {
  name = 'RefactorTemplateSystem1757500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, backup any existing invoice template relationships
    // We'll need to update invoices table to reference the new templates
    
    // Check if invoices table has template_id referencing invoice_templates
    const invoicesTable = await queryRunner.getTable('invoices');
    const templateForeignKey = invoicesTable?.foreignKeys.find(fk => fk.columnNames.includes('template_id'));
    
    if (templateForeignKey) {
      // Drop the foreign key constraint temporarily
      await queryRunner.dropForeignKey('invoices', templateForeignKey);
    }
    
    // Drop the old invoice_templates table
    await queryRunner.dropTable('invoice_templates', true, true, true);
    
    // Create the new templates table with proper tenant isolation
    await queryRunner.createTable(
      new Table({
        name: 'templates',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            comment: 'ULID identifier for the template',
          },
          {
            name: 'organization_id',
            type: 'varchar',
            isNullable: true,
            comment: 'NULL for system templates, set for organization-specific templates',
          },
          {
            name: 'category_id',
            type: 'varchar',
            isNullable: false,
            comment: 'Reference to template category',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
            comment: 'Template name',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
            comment: 'Template description',
          },
          {
            name: 'content',
            type: 'jsonb',
            isNullable: false,
            comment: 'Template content and configuration',
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
            comment: 'Whether the template is active',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Soft delete timestamp',
          },
        ],
        checks: [
          {
            name: 'name_length',
            expression: 'LENGTH(name) >= 1 AND LENGTH(name) <= 255',
          },
          {
            name: 'content_not_empty',
            expression: 'content IS NOT NULL',
          },
        ],
      }),
      true
    );
    
    // Create indexes for performance using SQL
    await queryRunner.query(`
      CREATE INDEX "IDX_templates_organization_id" ON "templates" ("organization_id")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_templates_category_id" ON "templates" ("category_id")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_templates_is_active" ON "templates" ("is_active")
    `);
    
    await queryRunner.query(`
      CREATE INDEX "IDX_templates_organization_id_is_active" ON "templates" ("organization_id", "is_active")
    `);
    
    // Create unique indexes for template names
    // For organization templates: unique within organization
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_templates_name_organization_unique" 
      ON "templates" ("name", "organization_id")
      WHERE "organization_id" IS NOT NULL
    `);
    
    // For system templates: globally unique
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_templates_name_system_unique" 
      ON "templates" ("name")
      WHERE "organization_id" IS NULL
    `);
    
    // Create foreign key constraints using SQL
    await queryRunner.query(`
      ALTER TABLE "templates" 
      ADD CONSTRAINT "FK_templates_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") 
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    
    await queryRunner.query(`
      ALTER TABLE "templates" 
      ADD CONSTRAINT "FK_templates_category_id" 
      FOREIGN KEY ("category_id") REFERENCES "template_categories"("id") 
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
    
    // Recreate the foreign key from invoices to templates if it existed
    if (templateForeignKey) {
      await queryRunner.query(`
        ALTER TABLE "invoices" 
        ADD CONSTRAINT "FK_invoices_template_id" 
        FOREIGN KEY ("template_id") REFERENCES "templates"("id") 
        ON DELETE SET NULL ON UPDATE CASCADE
      `);
    }
  }
  
  public async down(queryRunner: QueryRunner): Promise<void> {
    // This migration is not easily reversible due to the structural changes
    // We would need to recreate the invoice_templates table with all its complexity
    // For now, we'll just drop the templates table and recreate a basic invoice_templates table
    
    // Drop foreign keys first
    const templatesTable = await queryRunner.getTable('templates');
    if (templatesTable) {
      const foreignKeys = templatesTable.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('templates', foreignKey);
      }
    }
    
    // Drop the templates table
    await queryRunner.dropTable('templates', true, true, true);
    
    // Create a basic invoice_templates table for backward compatibility
    await queryRunner.createTable(
      new Table({
        name: 'invoice_templates',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'organization_id',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'category_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'template_type',
            type: 'varchar',
            length: '50',
            default: "'custom'",
          },
          {
            name: 's3_template_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'preview_image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'is_public',
            type: 'boolean',
            default: false,
          },
          {
            name: 'tags',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'variables',
            type: 'jsonb',
            default: '{}',
            isNullable: false,
          },
          {
            name: 'configuration',
            type: 'jsonb',
            default: '{}',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'usage_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true
    );
  }
}
