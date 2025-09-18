import { MigrationInterface, QueryRunner } from 'typeorm';

export class MigrateLegacyRolesToRBAC1757900000000 implements MigrationInterface {
  name = 'MigrateLegacyRolesToRBAC1757900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Starting migration of legacy roles to RBAC system...');

    // First, get all role IDs we'll need for the migration
    const roles = await queryRunner.query(`
      SELECT id, key, type FROM roles WHERE key IN (
        'super_admin', 'system_admin', 'owner', 'admin', 'manager', 'member', 'viewer'
      )
    `);

    const roleMap = new Map<string, string>();
    roles.forEach((role: any) => {
      roleMap.set(role.key, role.id);
    });

    console.log(`📋 Found ${roleMap.size} roles for mapping:`, Array.from(roleMap.keys()));

    // Get all users who don't have RBAC roles assigned yet
    const usersToMigrate = await queryRunner.query(`
      SELECT u.id, u.organization_id, u.role, u.is_admin, u.is_super_admin, u.wallet_address
      FROM users u 
      LEFT JOIN user_roles ur ON u.id = ur.user_id 
      WHERE ur.user_id IS NULL
    `);

    console.log(`👥 Found ${usersToMigrate.length} users to migrate to RBAC system`);

    let migratedCount = 0;

    // Migrate each user's roles
    for (const user of usersToMigrate) {
      const userRoles: Array<{ roleId: string; organizationId?: string }> = [];

      // Handle legacy 'role' column mapping
      if (user.role) {
        switch (user.role) {
          case 'owner':
            if (roleMap.has('owner')) {
              userRoles.push({ roleId: roleMap.get('owner')!, organizationId: user.organization_id });
            }
            break;
          case 'admin':
            if (roleMap.has('admin')) {
              userRoles.push({ roleId: roleMap.get('admin')!, organizationId: user.organization_id });
            }
            break;
          case 'manager':
            if (roleMap.has('manager')) {
              userRoles.push({ roleId: roleMap.get('manager')!, organizationId: user.organization_id });
            }
            break;
          case 'member':
            if (roleMap.has('member')) {
              userRoles.push({ roleId: roleMap.get('member')!, organizationId: user.organization_id });
            }
            break;
          case 'viewer':
            if (roleMap.has('viewer')) {
              userRoles.push({ roleId: roleMap.get('viewer')!, organizationId: user.organization_id });
            }
            break;
        }
      }

      // Handle is_admin flag
      if (user.is_admin && !user.is_super_admin) {
        // Users with is_admin=true but not super_admin get system_admin role
        if (roleMap.has('system_admin')) {
          userRoles.push({ roleId: roleMap.get('system_admin')! });
        }
      }

      // Handle is_super_admin flag
      if (user.is_super_admin) {
        // Users with is_super_admin=true get super_admin role
        if (roleMap.has('super_admin')) {
          userRoles.push({ roleId: roleMap.get('super_admin')! });
        }
      }

      // If no roles were determined, assign default member role for organization
      if (userRoles.length === 0 && user.organization_id && roleMap.has('member')) {
        userRoles.push({ roleId: roleMap.get('member')!, organizationId: user.organization_id });
      }

      // Insert user roles
      for (const userRole of userRoles) {
        // Generate ULID for user_role record
        const userRoleId = await this.generateULID();
        
        await queryRunner.query(`
          INSERT INTO user_roles (id, user_id, role_id, organization_id, granted_at, granted_by)
          VALUES ($1, $2, $3, $4, NOW(), $2)
          ON CONFLICT (user_id, role_id) DO NOTHING
        `, [
          userRoleId,
          user.id,
          userRole.roleId,
          userRole.organizationId || null
        ]);

        console.log(`  ✅ Assigned role to user ${user.wallet_address?.slice(0, 10)}... (${userRole.roleId})`);
      }

      migratedCount++;
    }

    console.log(`🎉 Successfully migrated ${migratedCount} users to RBAC system`);

    // Verify the migration
    const verifyCount = await queryRunner.query(`
      SELECT COUNT(*) as count FROM user_roles
    `);

    console.log(`📊 Total user_roles records after migration: ${verifyCount[0].count}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('⚠️  Rolling back RBAC migration...');

    // This is a complex rollback - we would need to:
    // 1. Identify which user_roles were created by this migration
    // 2. Remove only those records
    // 3. Restore legacy role values if needed

    // For safety, we'll only remove user_roles that were created after a certain timestamp
    // and log what we're doing rather than making assumptions
    
    console.log('⚠️  Manual rollback required. Please review user_roles table and remove records as needed.');
    console.log('    This migration cannot be automatically rolled back due to data integrity concerns.');
  }

  // Helper method to generate ULID (simplified version)
  private async generateULID(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15) + 
                  Math.random().toString(36).substring(2, 15);
    
    // Simple ULID-like ID for compatibility
    return timestamp.toString(36).toUpperCase().padStart(10, '0') + 
           random.toUpperCase().padStart(16, '0').substring(0, 16);
  }
}