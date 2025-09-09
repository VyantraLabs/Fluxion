import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddS3SupportToTemplates1757600000000 implements MigrationInterface {
  name = 'AddS3SupportToTemplates1757600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Adding S3 support columns to templates table...');
    
    // Add new columns to templates table
    await queryRunner.query(`
      ALTER TABLE templates 
      ADD COLUMN template_type varchar(50) DEFAULT 'custom' NOT NULL,
      ADD COLUMN s3_template_url varchar(500),
      ADD COLUMN preview_image_url varchar(500),
      ADD COLUMN is_public boolean DEFAULT false NOT NULL,
      ADD COLUMN tags varchar[],
      ADD COLUMN variables jsonb DEFAULT '{}' NOT NULL
    `);

    // Add check constraints
    await queryRunner.query(`
      ALTER TABLE templates 
      ADD CONSTRAINT CHK_templates_template_type 
        CHECK (template_type IN ('custom', 'system', 's3_based', 'generated')),
      ADD CONSTRAINT CHK_templates_s3_url_format 
        CHECK (s3_template_url IS NULL OR s3_template_url ~* '^(https?://.*\\.(json|html|pdf)$|templates/.*\\.(json|html|pdf)$)$')
    `);

    // Create indexes for new columns
    await queryRunner.createIndex('templates', new TableIndex({
      name: 'IDX_templates_template_type',
      columnNames: ['template_type']
    }));

    await queryRunner.createIndex('templates', new TableIndex({
      name: 'IDX_templates_is_public',
      columnNames: ['is_public']
    }));

    await queryRunner.createIndex('templates', new TableIndex({
      name: 'IDX_templates_tags',
      columnNames: ['tags'],
      where: 'tags IS NOT NULL'
    }));

    console.log('S3 support columns added to templates table successfully.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Removing S3 support columns from templates table...');

    // Drop indexes
    await queryRunner.dropIndex('templates', 'IDX_templates_tags');
    await queryRunner.dropIndex('templates', 'IDX_templates_is_public');
    await queryRunner.dropIndex('templates', 'IDX_templates_template_type');

    // Drop check constraints
    await queryRunner.query(`
      ALTER TABLE templates 
      DROP CONSTRAINT IF EXISTS CHK_templates_s3_url_format,
      DROP CONSTRAINT IF EXISTS CHK_templates_template_type
    `);

    // Drop columns
    await queryRunner.query(`
      ALTER TABLE templates 
      DROP COLUMN IF EXISTS variables,
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS is_public,
      DROP COLUMN IF EXISTS preview_image_url,
      DROP COLUMN IF EXISTS s3_template_url,
      DROP COLUMN IF EXISTS template_type
    `);

    console.log('S3 support columns removed from templates table successfully.');
  }
}