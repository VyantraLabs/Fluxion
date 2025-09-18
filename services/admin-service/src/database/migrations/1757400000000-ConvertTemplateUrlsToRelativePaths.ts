import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertTemplateUrlsToRelativePaths1757400000000 implements MigrationInterface {
  name = 'ConvertTemplateUrlsToRelativePaths1757400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Converting template URLs from full URLs to relative paths...');

    // Update s3_template_url column to store only relative paths
    // Remove various S3 bucket URL patterns that might exist
    await queryRunner.query(`
      UPDATE invoice_templates 
      SET s3_template_url = REGEXP_REPLACE(
        s3_template_url,
        '^https?://[^/]+/',
        '',
        'g'
      )
      WHERE s3_template_url IS NOT NULL 
      AND s3_template_url LIKE 'http%'
    `);

    // Update preview_image_url column to store only relative paths
    await queryRunner.query(`
      UPDATE invoice_templates 
      SET preview_image_url = REGEXP_REPLACE(
        preview_image_url,
        '^https?://[^/]+/',
        '',
        'g'
      )
      WHERE preview_image_url IS NOT NULL 
      AND preview_image_url LIKE 'http%'
    `);

    // Add new columns for better template organization
    await queryRunner.query(`
      ALTER TABLE invoice_templates
      ADD COLUMN IF NOT EXISTS category_id varchar,
      ADD COLUMN IF NOT EXISTS template_type varchar(50) DEFAULT 'system',
      ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS tags varchar[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'
    `);

    // Update CHECK constraint to allow relative paths
    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      DROP CONSTRAINT IF EXISTS s3_url_format
    `);

    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      ADD CONSTRAINT s3_url_format 
      CHECK (
        s3_template_url IS NULL OR 
        s3_template_url ~* '^(https?://.*\\.(json|html|pdf)$|templates/.*\\.(json|html|pdf)$)'
      )
    `);

    // Create indexes for new columns
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_invoice_templates_category_id 
      ON invoice_templates (category_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_invoice_templates_template_type 
      ON invoice_templates (template_type)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_invoice_templates_is_public 
      ON invoice_templates (is_public)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_invoice_templates_tags 
      ON invoice_templates USING GIN (tags) 
      WHERE tags IS NOT NULL
    `);

    console.log('✅ Successfully converted template URLs to relative paths');

    // Log conversion results
    const updatedTemplates = await queryRunner.query(`
      SELECT COUNT(*) as count, 
             COUNT(CASE WHEN s3_template_url LIKE 'templates/%' THEN 1 END) as relative_count
      FROM invoice_templates 
      WHERE s3_template_url IS NOT NULL
    `);

    if (updatedTemplates.length > 0) {
      console.log(`📊 Conversion Summary:`);
      console.log(`   • Total templates: ${updatedTemplates[0].count}`);
      console.log(`   • Converted to relative paths: ${updatedTemplates[0].relative_count}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Reverting template URLs back to full URLs...');

    // This would require knowing the original S3 bucket URLs
    // In practice, this should be handled carefully with backups
    console.warn('⚠️  WARNING: Down migration will use default S3 bucket URL');
    
    const DEFAULT_S3_URL = 'https://fluxion-templates-dev.s3.ap-south-1.amazonaws.com';

    // Convert relative paths back to full URLs
    await queryRunner.query(`
      UPDATE invoice_templates 
      SET s3_template_url = CONCAT($1, '/', s3_template_url)
      WHERE s3_template_url IS NOT NULL 
      AND s3_template_url NOT LIKE 'http%'
    `, [DEFAULT_S3_URL]);

    await queryRunner.query(`
      UPDATE invoice_templates 
      SET preview_image_url = CONCAT($1, '/', preview_image_url)
      WHERE preview_image_url IS NOT NULL 
      AND preview_image_url NOT LIKE 'http%'
    `, [DEFAULT_S3_URL]);

    // Remove new columns
    await queryRunner.query(`
      ALTER TABLE invoice_templates
      DROP COLUMN IF EXISTS category_id,
      DROP COLUMN IF EXISTS template_type,
      DROP COLUMN IF EXISTS is_public,
      DROP COLUMN IF EXISTS tags,
      DROP COLUMN IF EXISTS variables
    `);

    // Drop new indexes
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_invoice_templates_category_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_invoice_templates_template_type`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_invoice_templates_is_public`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_invoice_templates_tags`);

    // Restore original CHECK constraint
    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      DROP CONSTRAINT IF EXISTS s3_url_format
    `);

    await queryRunner.query(`
      ALTER TABLE invoice_templates 
      ADD CONSTRAINT s3_url_format 
      CHECK (s3_template_url IS NULL OR s3_template_url ~* '^https?://.*\\.(json|html|pdf)$')
    `);

    console.log('✅ Reverted template URLs to full URLs format');
  }
}