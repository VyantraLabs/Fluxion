import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixS3UrlsToSystemStructure1757410785767 implements MigrationInterface {
  name = 'FixS3UrlsToSystemStructure1757410785767';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Fixing S3 URLs to use proper /templates/system/[category]/ structure...');
    
    // Update all S3 template URLs to include 'system' directory
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/', 'templates/system/')
      WHERE organization_id = '010000000000000000000000'
      AND s3_template_url LIKE 'templates/%'
      AND s3_template_url NOT LIKE 'templates/system/%'
    `);
    
    console.log(`✅ Updated S3 URLs for system templates`);
    
    // Also update preview image URLs if they exist
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/', 'templates/system/')
      WHERE organization_id = '010000000000000000000000'
      AND preview_image_url LIKE 'templates/%'
      AND preview_image_url NOT LIKE 'templates/system/%'
    `);
    
    console.log('✅ Updated preview image URLs for system templates');
    
    // Verify the results
    const finalCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM templates 
      WHERE organization_id = '010000000000000000000000'
      AND s3_template_url LIKE 'templates/system/%'
    `);
    
    console.log(`✅ Final verification: ${finalCount[0].count} templates now use proper S3 structure`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Reverting S3 URLs to remove /system/ directory...');
    
    // Revert S3 template URLs
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/system/', 'templates/')
      WHERE organization_id = '010000000000000000000000'
      AND s3_template_url LIKE 'templates/system/%'
    `);
    
    // Revert preview image URLs
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/system/', 'templates/')
      WHERE organization_id = '010000000000000000000000'
      AND preview_image_url LIKE 'templates/system/%'
    `);
    
    console.log('✅ S3 URLs reverted successfully');
  }
}
