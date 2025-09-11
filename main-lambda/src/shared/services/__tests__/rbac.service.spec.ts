import { DataSource } from 'typeorm';
import { RBACService } from '../rbac.service';
import { Role, SystemRoleKey, OrganizationRoleKey, RoleType } from '@/database/entities/Role';
import { Permission, PermissionCategory } from '@/database/entities/Permission';
import { UserRole } from '@/database/entities/UserRole';
import { User } from '@/database/entities/User';
import { Organization } from '@/database/entities/Organization';
import { ulid } from 'ulid';

describe('RBACService', () => {
  let dataSource: DataSource;
  let rbacService: RBACService;
  let testUser: User;
  let testOrganization: Organization;

  beforeAll(async () => {
    // Use test database connection
    dataSource = global.testDataSource;
    rbacService = new RBACService(dataSource);
  });

  beforeEach(async () => {
    // Clear test data
    await dataSource.getRepository(UserRole).delete({});
    await dataSource.getRepository(Permission).delete({});
    await dataSource.getRepository(Role).delete({});
    await dataSource.getRepository(User).delete({});
    await dataSource.getRepository(Organization).delete({});

    // Create test organization
    testOrganization = dataSource.getRepository(Organization).create({
      id: ulid(),
      name: 'Test Organization',
      slug: 'test-org'
    });
    await dataSource.getRepository(Organization).save(testOrganization);

    // Create test user
    testUser = dataSource.getRepository(User).create({
      id: ulid(),
      organizationId: testOrganization.id,
      email: 'test@example.com',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      role: 'member'
    });
    await dataSource.getRepository(User).save(testUser);

    // Initialize RBAC system
    await rbacService.initializeRBACSystem();
  });

  describe('System Initialization', () => {
    test('should create default roles', async () => {
      const roleRepository = dataSource.getRepository(Role);
      
      const superAdminRole = await roleRepository.findOne({ 
        where: { key: SystemRoleKey.SUPER_ADMIN } 
      });
      expect(superAdminRole).toBeTruthy();
      expect(superAdminRole?.type).toBe(RoleType.SYSTEM);
      expect(superAdminRole?.isSystemRole).toBe(true);

      const ownerRole = await roleRepository.findOne({ 
        where: { key: OrganizationRoleKey.OWNER } 
      });
      expect(ownerRole).toBeTruthy();
      expect(ownerRole?.type).toBe(RoleType.ORGANIZATION);
      expect(ownerRole?.isSystemRole).toBe(false);
    });

    test('should create default permissions', async () => {
      const permissionRepository = dataSource.getRepository(Permission);
      
      const invoiceCreatePerm = await permissionRepository.findOne({
        where: { key: 'invoice:create' }
      });
      expect(invoiceCreatePerm).toBeTruthy();
      expect(invoiceCreatePerm?.category).toBe(PermissionCategory.INVOICE);

      const systemNetworksPerm = await permissionRepository.findOne({
        where: { key: 'system:networks' }
      });
      expect(systemNetworksPerm).toBeTruthy();
      expect(systemNetworksPerm?.isSystemPermission).toBe(true);
    });

    test('should assign permissions to roles', async () => {
      const roleRepository = dataSource.getRepository(Role);
      
      const superAdminRole = await roleRepository.findOne({ 
        where: { key: SystemRoleKey.SUPER_ADMIN },
        relations: ['permissions', 'permissions.permission']
      });
      
      expect(superAdminRole?.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('Role Assignment', () => {
    test('should assign system role to user', async () => {
      await rbacService.assignRole(
        testUser.id,
        SystemRoleKey.SYSTEM_ADMIN,
        undefined,
        testUser.id
      );

      const userRoles = await rbacService.getUserRoles(testUser.id);
      expect(userRoles).toHaveLength(1);
      expect(userRoles[0].role.key).toBe(SystemRoleKey.SYSTEM_ADMIN);
      expect(userRoles[0].organizationId).toBeUndefined();
    });

    test('should assign organization role to user', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        testUser.id
      );

      const userRoles = await rbacService.getUserRoles(testUser.id, testOrganization.id);
      expect(userRoles).toHaveLength(1);
      expect(userRoles[0].role.key).toBe(OrganizationRoleKey.ADMIN);
      expect(userRoles[0].organizationId).toBe(testOrganization.id);
    });

    test('should not allow duplicate role assignments', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.MEMBER,
        testOrganization.id,
        testUser.id
      );

      // Second assignment should not fail but return existing role
      const userRole = await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.MEMBER,
        testOrganization.id,
        testUser.id
      );

      const userRoles = await rbacService.getUserRoles(testUser.id, testOrganization.id);
      expect(userRoles).toHaveLength(1);
    });

    test('should validate organization context for organization roles', async () => {
      await expect(
        rbacService.assignRole(
          testUser.id,
          OrganizationRoleKey.ADMIN,
          undefined, // Missing organization ID
          testUser.id
        )
      ).rejects.toThrow('Organization ID required');
    });

    test('should reject organization context for system roles', async () => {
      await expect(
        rbacService.assignRole(
          testUser.id,
          SystemRoleKey.SYSTEM_ADMIN,
          testOrganization.id, // Organization ID not allowed
          testUser.id
        )
      ).rejects.toThrow('Organization ID not allowed');
    });
  });

  describe('Role Removal', () => {
    test('should remove role from user', async () => {
      // Assign role first
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        testUser.id
      );

      let userRoles = await rbacService.getUserRoles(testUser.id, testOrganization.id);
      expect(userRoles).toHaveLength(1);

      // Remove role
      await rbacService.removeRole(
        testUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id
      );

      userRoles = await rbacService.getUserRoles(testUser.id, testOrganization.id);
      expect(userRoles).toHaveLength(0);
    });
  });

  describe('Permission Checking', () => {
    test('should grant permission for user with appropriate role', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        testUser.id
      );

      const hasPermission = await rbacService.hasPermission(
        testUser.id,
        'user:manage',
        { organizationId: testOrganization.id }
      );

      expect(hasPermission).toBe(true);
    });

    test('should deny permission for user without appropriate role', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.VIEWER,
        testOrganization.id,
        testUser.id
      );

      const hasPermission = await rbacService.hasPermission(
        testUser.id,
        'user:manage',
        { organizationId: testOrganization.id }
      );

      expect(hasPermission).toBe(false);
    });

    test('should handle wildcard permissions', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.OWNER,
        testOrganization.id,
        testUser.id
      );

      const hasPermission = await rbacService.hasPermission(
        testUser.id,
        'invoice:create',
        { organizationId: testOrganization.id }
      );

      expect(hasPermission).toBe(true);
    });

    test('should grant system admin override', async () => {
      await rbacService.assignRole(
        testUser.id,
        SystemRoleKey.SUPER_ADMIN,
        undefined,
        testUser.id
      );

      const hasPermission = await rbacService.hasPermission(
        testUser.id,
        'any:permission',
        { allowSystemOverride: true }
      );

      expect(hasPermission).toBe(true);
    });

    test('should check multiple permissions with requireAll', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        testUser.id
      );

      const hasAllPermissions = await rbacService.hasPermission(
        testUser.id,
        ['user:manage', 'invoice:create'],
        { requireAll: true, organizationId: testOrganization.id }
      );

      expect(hasAllPermissions).toBe(true);

      const hasAllWithMissing = await rbacService.hasPermission(
        testUser.id,
        ['user:manage', 'system:networks'],
        { requireAll: true, organizationId: testOrganization.id }
      );

      expect(hasAllWithMissing).toBe(false);
    });

    test('should check multiple permissions with requireAny (default)', async () => {
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.VIEWER,
        testOrganization.id,
        testUser.id
      );

      const hasAnyPermission = await rbacService.hasPermission(
        testUser.id,
        ['user:manage', 'invoice:read'],
        { requireAll: false, organizationId: testOrganization.id }
      );

      expect(hasAnyPermission).toBe(true); // Has invoice:read
    });
  });

  describe('User Permissions', () => {
    test('should get complete user permissions', async () => {
      await rbacService.assignRole(
        testUser.id,
        SystemRoleKey.SYSTEM_ADMIN,
        undefined,
        testUser.id
      );

      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.OWNER,
        testOrganization.id,
        testUser.id
      );

      const userPermissions = await rbacService.getUserPermissions(testUser.id);

      expect(userPermissions).toBeTruthy();
      expect(userPermissions!.permissions.length).toBeGreaterThan(0);
      expect(userPermissions!.roles.length).toBe(2);
      expect(userPermissions!.isSystemAdmin).toBe(true);
      expect(userPermissions!.canCrossOrganizations).toBe(true);
    });

    test('should filter permissions by organization context', async () => {
      const anotherOrg = dataSource.getRepository(Organization).create({
        id: ulid(),
        name: 'Another Organization',
        slug: 'another-org'
      });
      await dataSource.getRepository(Organization).save(anotherOrg);

      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        testUser.id
      );

      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.VIEWER,
        anotherOrg.id,
        testUser.id
      );

      // Get permissions for specific organization
      const orgPermissions = await rbacService.getUserPermissions(
        testUser.id, 
        testOrganization.id
      );

      expect(orgPermissions!.roles).toHaveLength(1);
      expect(orgPermissions!.roles[0].role.key).toBe(OrganizationRoleKey.ADMIN);
    });
  });

  describe('User Management Authorization', () => {
    let managerUser: User;
    let targetUser: User;

    beforeEach(async () => {
      managerUser = dataSource.getRepository(User).create({
        id: ulid(),
        organizationId: testOrganization.id,
        email: 'manager@example.com',
        walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        role: 'admin'
      });
      await dataSource.getRepository(User).save(managerUser);

      targetUser = dataSource.getRepository(User).create({
        id: ulid(),
        organizationId: testOrganization.id,
        email: 'target@example.com',
        walletAddress: '0x9876543210fedcba9876543210fedcba98765432',
        role: 'member'
      });
      await dataSource.getRepository(User).save(targetUser);
    });

    test('should allow admin to manage users in same organization', async () => {
      await rbacService.assignRole(
        managerUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        managerUser.id
      );

      await rbacService.assignRole(
        targetUser.id,
        OrganizationRoleKey.MEMBER,
        testOrganization.id,
        targetUser.id
      );

      const canManage = await rbacService.canManageUser(
        managerUser.id,
        targetUser.id,
        testOrganization.id
      );

      expect(canManage).toBe(true);
    });

    test('should deny management across different organizations', async () => {
      const anotherOrg = dataSource.getRepository(Organization).create({
        id: ulid(),
        name: 'Another Organization',
        slug: 'another-org'
      });
      await dataSource.getRepository(Organization).save(anotherOrg);

      const externalUser = dataSource.getRepository(User).create({
        id: ulid(),
        organizationId: anotherOrg.id,
        email: 'external@example.com',
        walletAddress: '0x1111111111111111111111111111111111111111',
        role: 'member'
      });
      await dataSource.getRepository(User).save(externalUser);

      await rbacService.assignRole(
        managerUser.id,
        OrganizationRoleKey.ADMIN,
        testOrganization.id,
        managerUser.id
      );

      const canManage = await rbacService.canManageUser(
        managerUser.id,
        externalUser.id,
        testOrganization.id
      );

      expect(canManage).toBe(false);
    });

    test('should allow system admin to manage any user', async () => {
      await rbacService.assignRole(
        managerUser.id,
        SystemRoleKey.SUPER_ADMIN,
        undefined,
        managerUser.id
      );

      const canManage = await rbacService.canManageUser(
        managerUser.id,
        targetUser.id,
        testOrganization.id
      );

      expect(canManage).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle user with no roles', async () => {
      const userPermissions = await rbacService.getUserPermissions(testUser.id);
      expect(userPermissions).toBeNull();

      const hasPermission = await rbacService.hasPermission(
        testUser.id,
        'invoice:create'
      );
      expect(hasPermission).toBe(false);
    });

    test('should handle expired roles', async () => {
      const userRoleRepo = dataSource.getRepository(UserRole);
      
      await rbacService.assignRole(
        testUser.id,
        OrganizationRoleKey.MEMBER,
        testOrganization.id,
        testUser.id,
        1 // 1 day expiration
      );

      // Manually expire the role
      const userRole = await userRoleRepo.findOne({
        where: { userId: testUser.id }
      });
      
      if (userRole) {
        userRole.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
        await userRoleRepo.save(userRole);
      }

      const hasPermission = await rbacService.hasPermission(
        testUser.id,
        'invoice:create',
        { organizationId: testOrganization.id }
      );

      expect(hasPermission).toBe(false);
    });

    test('should handle non-existent user', async () => {
      await expect(
        rbacService.assignRole(
          'non-existent-user-id',
          OrganizationRoleKey.MEMBER,
          testOrganization.id,
          testUser.id
        )
      ).rejects.toThrow('User not found');
    });

    test('should handle non-existent role', async () => {
      await expect(
        rbacService.assignRole(
          testUser.id,
          'non-existent-role' as OrganizationRoleKey,
          testOrganization.id,
          testUser.id
        )
      ).rejects.toThrow('Role not found');
    });
  });
});