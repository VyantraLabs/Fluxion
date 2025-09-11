import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLegacyRoleColumns1757950000000 implements MigrationInterface {
  name = 'RemoveLegacyRoleColumns1757950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🗑️  Starting removal of legacy role columns from users table...');

    // Before removing columns, let's verify all users have RBAC roles assigned
    const usersWithoutRoles = await queryRunner.query(`
      SELECT COUNT(*) as count 
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      WHERE ur.user_id IS NULL
    `);

    if (parseInt(usersWithoutRoles[0].count) > 0) {
      throw new Error(`❌ Cannot proceed: ${usersWithoutRoles[0].count} users still don't have RBAC roles assigned. Please run the previous migration first.`);
    }

    console.log('✅ All users have RBAC roles assigned. Proceeding with column removal...');

    // Drop any indexes that might reference the columns we're about to remove
    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_role"`);
      console.log('  🗑️  Dropped index on role column (if existed)');
    } catch (error) {
      console.log('  ⚠️  No role index found to drop');
    }

    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_admin"`);
      console.log('  🗑️  Dropped index on is_admin column (if existed)');
    } catch (error) {
      console.log('  ⚠️  No is_admin index found to drop');
    }

    try {
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_is_super_admin"`);
      console.log('  🗑️  Dropped index on is_super_admin column (if existed)');
    } catch (error) {
      console.log('  ⚠️  No is_super_admin index found to drop');
    }

    // Remove the legacy columns
    try {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "role"`);
      console.log('  ✅ Removed legacy "role" column');
    } catch (error) {
      console.log('  ⚠️  Role column may not exist:', error);
    }

    try {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin"`);
      console.log('  ✅ Removed legacy "is_admin" column');
    } catch (error) {
      console.log('  ⚠️  is_admin column may not exist:', error);
    }

    try {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "is_super_admin"`);
      console.log('  ✅ Removed legacy "is_super_admin" column');
    } catch (error) {
      console.log('  ⚠️  is_super_admin column may not exist:', error);
    }

    // Remove related admin tracking columns that are no longer needed
    try {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_granted_at"`);
      console.log('  ✅ Removed "admin_granted_at" column');
    } catch (error) {
      console.log('  ⚠️  admin_granted_at column may not exist:', error);
    }

    try {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "admin_granted_by"`);
      console.log('  ✅ Removed "admin_granted_by" column');
    } catch (error) {
      console.log('  ⚠️  admin_granted_by column may not exist:', error);
    }

    console.log('🎉 Successfully removed all legacy role columns from users table');
    
    // Verify the final state
    const tableInfo = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);

    const columns = tableInfo.map((col: any) => col.column_name);
    console.log('📊 Current users table columns:', columns);
    
    // Ensure none of the removed columns are still there
    const removedColumns = ['role', 'is_admin', 'is_super_admin', 'admin_granted_at', 'admin_granted_by'];
    const stillPresent = columns.filter((col: string) => removedColumns.includes(col));
    
    if (stillPresent.length > 0) {
      console.log(`⚠️  Warning: Some columns may still be present: ${stillPresent.join(', ')}`);
    } else {
      console.log('✅ Confirmed: All legacy role columns have been removed');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  Rolling back legacy column removal...');

    // Recreate the columns with their original definitions
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "role" varchar(50) DEFAULT 'member' NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "is_super_admin" boolean DEFAULT false NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "admin_granted_at" timestamptz
    `);

    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "admin_granted_by" varchar(255)
    `);

    console.log('⚠️  Legacy columns restored, but data will need to be manually repopulated from user_roles table');
    console.log('    This rollback does not automatically restore the legacy role data.');
  }
}