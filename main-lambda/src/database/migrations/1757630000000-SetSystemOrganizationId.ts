import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetSystemOrganizationId1757630000000 implements MigrationInterface {
  name = 'SetSystemOrganizationId1757630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Setting system organization ID to 010000000000000000000000...');
    
    // First, create the system organization if it doesn't exist
    await queryRunner.query(`
      INSERT INTO organizations (id, name, slug, plan, settings, created_at, updated_at)
      VALUES ('010000000000000000000000', 'Fluxion System Templates', 'system-templates', 'system', '{}', NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Update all system templates (those with organizationId = NULL) to use the system organization ID
    const updateResult = await queryRunner.query(`
      UPDATE templates 
      SET organization_id = '010000000000000000000000'
      WHERE organization_id IS NULL
      AND template_type = 's3_based'
      AND is_public = true
    `);
    
    console.log(`Updated ${updateResult.affectedRows || 'unknown'} system templates with organization ID`);
    
    // Verify the update
    const systemTemplateCount = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM templates 
      WHERE organization_id = '010000000000000000000000'
    `);
    
    console.log(`System templates count: ${systemTemplateCount[0].count}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Reverting system organization ID...');
    
    // Revert system templates back to NULL organization_id
    await queryRunner.query(`
      UPDATE templates 
      SET organization_id = NULL
      WHERE organization_id = '010000000000000000000000'
    `);
    
    // Remove the system organization
    await queryRunner.query(`
      DELETE FROM organizations 
      WHERE id = '010000000000000000000000'
    `);
  }
}