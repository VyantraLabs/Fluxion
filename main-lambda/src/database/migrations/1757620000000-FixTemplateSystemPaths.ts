import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTemplateSystemPaths1757620000000 implements MigrationInterface {
  name = 'FixTemplateSystemPaths1757620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Fixing template paths to use templates/system/* structure...');
    
    // Update all template URLs that don't already have /system/ in the path
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/', 'templates/system/')
      WHERE s3_template_url IS NOT NULL 
      AND s3_template_url LIKE 'templates/%'
      AND s3_template_url NOT LIKE 'templates/system/%'
    `);
    
    // Update preview image URLs
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/', 'templates/system/')
      WHERE preview_image_url IS NOT NULL 
      AND preview_image_url LIKE 'templates/%'
      AND preview_image_url NOT LIKE 'templates/system/%'
    `);
    
    // Log the results
    const templateCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM templates 
      WHERE s3_template_url LIKE 'templates/system/%'
    `);
    
    console.log(`Updated ${templateCount[0].count} templates to use templates/system/* structure`);
    
    // Also fix any templates that might have double system/system
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/system/system/', 'templates/system/')
      WHERE s3_template_url LIKE 'templates/system/system/%'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/system/system/', 'templates/system/')
      WHERE preview_image_url LIKE 'templates/system/system/%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Reverting template paths to remove /system/ directory...');
    
    // Revert template URLs
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/system/', 'templates/')
      WHERE s3_template_url IS NOT NULL 
      AND s3_template_url LIKE 'templates/system/%'
    `);
    
    // Revert preview image URLs
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/system/', 'templates/')
      WHERE preview_image_url IS NOT NULL 
      AND preview_image_url LIKE 'templates/system/%'
    `);
  }
}