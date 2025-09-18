import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddTemplateCategoriesAndS3Support1757340000000 implements MigrationInterface {
  name = 'AddTemplateCategoriesAndS3Support1757340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create template_categories table
    await queryRunner.createTable(new Table({
      name: 'template_categories',
      columns: [
        {
          name: 'id',
          type: 'varchar',
          isPrimary: true,
        },
        {
          name: 'name',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'description',
          type: 'text',
          isNullable: true,
        },
        {
          name: 'slug',
          type: 'varchar',
          length: '100',
          isNullable: false,
          isUnique: true,
        },
        {
          name: 'icon',
          type: 'varchar',
          length: '50',
          isNullable: true,
        },
        {
          name: 'color',
          type: 'varchar',
          length: '7',
          isNullable: true,
          comment: 'Hex color code for category theming',
        },
        {
          name: 'sort_order',
          type: 'integer',
          default: 0,
          isNullable: false,
        },
        {
          name: 'is_system',
          type: 'boolean',
          default: false,
          isNullable: false,
          comment: 'Whether this is a system-defined category',
        },
        {
          name: 'is_active',
          type: 'boolean',
          default: true,
          isNullable: false,
        },
        {
          name: 'created_at',
          type: 'timestamp with time zone',
          default: 'CURRENT_TIMESTAMP',
          isNullable: false,
        },
        {
          name: 'updated_at',
          type: 'timestamp with time zone',
          default: 'CURRENT_TIMESTAMP',
          isNullable: false,
        },
      ],
    }));

    // Create indexes for template_categories
    await queryRunner.createIndex('template_categories', new TableIndex({
      name: 'IDX_template_categories_slug',
      columnNames: ['slug'],
      isUnique: true
    }));
    await queryRunner.createIndex('template_categories', new TableIndex({
      name: 'IDX_template_categories_sort_order',
      columnNames: ['sort_order']
    }));
    await queryRunner.createIndex('template_categories', new TableIndex({
      name: 'IDX_template_categories_is_system',
      columnNames: ['is_system']
    }));

    // Add category and S3 support columns to invoice_templates
    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      ADD COLUMN category_id varchar,
      ADD COLUMN template_type varchar(50) DEFAULT 'custom',
      ADD COLUMN s3_template_url varchar(500),
      ADD COLUMN preview_image_url varchar(500),
      ADD COLUMN is_public boolean DEFAULT false,
      ADD COLUMN tags varchar[],
      ADD COLUMN variables jsonb DEFAULT '{}',
      ADD CONSTRAINT FK_invoice_templates_category 
        FOREIGN KEY (category_id) 
        REFERENCES template_categories(id) 
        ON DELETE SET NULL
    `);

    // Create indexes for new columns
    await queryRunner.createIndex('invoice_templates', new TableIndex({
      name: 'IDX_invoice_templates_category_id',
      columnNames: ['category_id']
    }));
    await queryRunner.createIndex('invoice_templates', new TableIndex({
      name: 'IDX_invoice_templates_template_type',
      columnNames: ['template_type']
    }));
    await queryRunner.createIndex('invoice_templates', new TableIndex({
      name: 'IDX_invoice_templates_is_public',
      columnNames: ['is_public']
    }));
    await queryRunner.createIndex('invoice_templates', new TableIndex({
      name: 'IDX_invoice_templates_tags',
      columnNames: ['tags'],
      where: 'tags IS NOT NULL'
    }));

    // Add check constraints
    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      ADD CONSTRAINT CHK_template_type 
        CHECK (template_type IN ('custom', 'system', 's3_based', 'generated')),
      ADD CONSTRAINT CHK_s3_url_format 
        CHECK (s3_template_url IS NULL OR s3_template_url ~* '^(https?://.*\\.(json|html|pdf)$|templates/.*\\.(json|html|pdf)$)$')
    `);

    // Insert default system categories
    await queryRunner.query(`
      INSERT INTO template_categories (id, name, description, slug, icon, color, sort_order, is_system, is_active) VALUES
      ('01HZ0000000000000000000001', 'Invoices', 'Standard business invoices for services and products', 'invoices', 'FileText', '#3B82F6', 1, true, true),
      ('01HZ0000000000000000000002', 'Payslips', 'Employee salary and payment slips', 'payslips', 'CreditCard', '#10B981', 2, true, true),
      ('01HZ0000000000000000000003', 'Reminders', 'Payment reminder and follow-up templates', 'reminders', 'Bell', '#F59E0B', 3, true, true),
      ('01HZ0000000000000000000004', 'Receipts', 'Payment confirmation and receipt templates', 'receipts', 'CheckCircle', '#8B5CF6', 4, true, true),
      ('01HZ0000000000000000000005', 'Estimates', 'Project estimates and quotes', 'estimates', 'Calculator', '#EF4444', 5, true, true),
      ('01HZ0000000000000000000006', 'Contracts', 'Service agreements and contract templates', 'contracts', 'FileSignature', '#6B7280', 6, true, true)
    `);

    // Update existing templates to have a default category
    await queryRunner.query(`
      UPDATE invoice_templates 
      SET category_id = '01HZ0000000000000000000001',
          template_type = 'custom'
      WHERE category_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraint
    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      DROP CONSTRAINT IF EXISTS FK_invoice_templates_category
    `);

    // Remove added columns from invoice_templates
    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      DROP COLUMN IF EXISTS category_id,
      DROP COLUMN IF EXISTS template_type,
      DROP COLUMN IF EXISTS s3_template_url,
      DROP COLUMN IF EXISTS preview_image_url,
      DROP COLUMN IF EXISTS is_public,
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS variables
    `);

    // Drop template_categories table
    await queryRunner.dropTable('template_categories', true);
  }
}