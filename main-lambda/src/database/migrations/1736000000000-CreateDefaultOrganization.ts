import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDefaultOrganization1736000000000 implements MigrationInterface {
  name = 'CreateDefaultOrganization1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if there's already an organization with slug 'default'
    const existingOrgBySlug = await queryRunner.query(`
      SELECT id, name, slug FROM organizations WHERE slug = 'default'
    `);

    // Check if organization with the specific UUID exists
    const existingOrgById = await queryRunner.query(`
      SELECT id, name, slug FROM organizations WHERE id = '00000000-0000-0000-0000-000000000000'
    `);

    const targetId = '00000000-0000-0000-0000-000000000000';

    if (existingOrgById.length > 0) {
      console.log('Default organization with target ID already exists');
      return;
    }

    if (existingOrgBySlug.length > 0) {
      // Update the existing organization's ID to the expected UUID
      console.log('Updating existing default organization ID to:', targetId);
      
      await queryRunner.query(`
        UPDATE organizations 
        SET id = $1
        WHERE slug = 'default'
      `, [targetId]);
    } else {
      // Insert new default organization with specific UUID
      console.log('Creating new default organization with ID:', targetId);
      
      await queryRunner.query(`
        INSERT INTO "organizations" (
          "id",
          "name", 
          "slug",
          "plan",
          "settings",
          "created_at",
          "updated_at"
        ) VALUES (
          $1,
          'Default Organization',
          'default',
          'basic',
          $2,
          NOW(),
          NOW()
        );
      `, [
        targetId,
        JSON.stringify({
          timezone: 'UTC',
          currency: 'USD',
          invoiceNumberPrefix: 'INV',
          paymentTerms: 30,
          features: {
            multiCurrency: false,
            customBranding: false,
            advancedReporting: false
          }
        })
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the default organization
    await queryRunner.query(`
      DELETE FROM "organizations" 
      WHERE "id" = '00000000-0000-0000-0000-000000000000';
    `);
  }
}