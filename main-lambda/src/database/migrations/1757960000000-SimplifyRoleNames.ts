import { MigrationInterface, QueryRunner } from 'typeorm';

export class SimplifyRoleNames1757960000000 implements MigrationInterface {
  name = 'SimplifyRoleNames1757960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Update role keys to use clean, simple names
    // system_admin -> admin
    // support_agent -> support  
    // admin (organization) -> org_admin (to avoid conflict)

    // Update system_admin to admin
    await queryRunner.query(`
      UPDATE roles 
      SET key = 'admin', name = 'Admin'
      WHERE key = 'system_admin' AND type = 'system'
    `);

    // Update support_agent to support
    await queryRunner.query(`
      UPDATE roles 
      SET key = 'support', name = 'Support'
      WHERE key = 'support_agent' AND type = 'system'
    `);

    // Update organization admin to avoid conflict
    await queryRunner.query(`
      UPDATE roles 
      SET key = 'org_admin', name = 'Organization Administrator'
      WHERE key = 'admin' AND type = 'organization'
    `);

    console.log('✅ Simplified role names:');
    console.log('  - system_admin → admin');
    console.log('  - support_agent → support');
    console.log('  - admin (organization) → org_admin');
    console.log('  - All other roles unchanged');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert the changes
    await queryRunner.query(`
      UPDATE roles 
      SET key = 'system_admin', name = 'System Administrator'
      WHERE key = 'admin' AND type = 'system'
    `);

    await queryRunner.query(`
      UPDATE roles 
      SET key = 'support_agent', name = 'Support Agent'
      WHERE key = 'support' AND type = 'system'
    `);

    await queryRunner.query(`
      UPDATE roles 
      SET key = 'admin', name = 'Organization Administrator'
      WHERE key = 'org_admin' AND type = 'organization'
    `);

    console.log('✅ Reverted role names to original format');
  }
}