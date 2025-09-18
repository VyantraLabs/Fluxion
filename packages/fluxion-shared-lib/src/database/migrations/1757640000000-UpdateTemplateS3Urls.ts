import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateTemplateS3Urls1757640000000 implements MigrationInterface {
  name = 'UpdateTemplateS3Urls1757640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Updating template S3 URLs to use templates/system/* paths...');
    
    // Update invoice templates
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/invoices/professional-business.html'
      WHERE name = 'Professional Business Invoice Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/invoices/modern-minimalist.html'
      WHERE name = 'Modern Minimalist Invoice Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/invoices/tech-startup.html'
      WHERE name = 'Tech Startup Invoice Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/invoices/creative-agency.html'
      WHERE name = 'Creative Agency Invoice Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/invoices/consulting-services.html'
      WHERE name = 'Consulting Services Invoice Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Update receipt templates
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/receipts/crypto-payment.html'
      WHERE name = 'Crypto Payment Receipt Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/receipts/service-payment.html'
      WHERE name = 'Service Payment Receipt Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Update estimate templates
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/estimates/detailed-project.html'
      WHERE name = 'Detailed Project Estimate Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/estimates/quick-service-quote.html'
      WHERE name = 'Quick Service Quote Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Update proposal templates
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/proposals/business-proposal.html'
      WHERE name = 'Business Proposal Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/proposals/creative-project.html'
      WHERE name = 'Creative Project Proposal Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Update contract templates
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/contracts/service-agreement.html'
      WHERE name = 'Service Agreement Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/contracts/freelance-contract.html'
      WHERE name = 'Freelance Contract Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Update report templates
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/reports/monthly-progress.html'
      WHERE name = 'Monthly Progress Report Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = 'templates/system/reports/financial-summary.html'
      WHERE name = 'Financial Summary Report Template'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Update preview image URLs to match system structure
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/previews/', 'templates/system/previews/')
      WHERE preview_image_url LIKE 'templates/previews/%'
      AND organization_id = '010000000000000000000000'
    `);
    
    // Log results
    const updatedCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM templates 
      WHERE s3_template_url LIKE 'templates/system/%'
      AND organization_id = '010000000000000000000000'
    `);
    
    console.log(`Updated ${updatedCount[0].count} templates with correct S3 URLs`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Reverting template S3 URLs...');
    
    // Revert S3 URLs back to old format
    await queryRunner.query(`
      UPDATE templates 
      SET s3_template_url = REPLACE(s3_template_url, 'templates/system/', 'templates/')
      WHERE s3_template_url LIKE 'templates/system/%'
    `);
    
    // Revert preview image URLs
    await queryRunner.query(`
      UPDATE templates 
      SET preview_image_url = REPLACE(preview_image_url, 'templates/system/previews/', 'templates/previews/')
      WHERE preview_image_url LIKE 'templates/system/previews/%'
    `);
  }
}