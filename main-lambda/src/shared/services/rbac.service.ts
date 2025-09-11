import { Repository, IsNull } from 'typeorm';
import { Logger } from '@/shared/utils/logger';
import { Role, RoleType, SystemRoleKey, OrganizationRoleKey } from '@/database/entities/Role';
import { Permission } from '@/database/entities/Permission';
import { UserRole } from '@/database/entities/UserRole';
import { RolePermission } from '@/database/entities/RolePermission';
import { User } from '@/database/entities/User';
import { AppDataSource } from '@/database/data-source';
import { 
  createNotFoundError, 
  createValidationError
} from '@/shared/errors';

export interface UserPermissions {
  permissions: string[];
  roles: Array<{
    role: Role;
    organizationId?: string;
    isExpired: boolean;
  }>;
  isSystemAdmin: boolean;
  canCrossOrganizations: boolean;
}

export interface PermissionCheckOptions {
  requireAll?: boolean; // If true, user must have ALL permissions, otherwise ANY
  organizationId?: string; // Specific organization context
  allowSystemOverride?: boolean; // If true, system roles can override org restrictions
}

export class RBACService {
  private logger = new Logger('RBACService');
  private roleRepo: Repository<Role>;
  private permissionRepo: Repository<Permission>;
  private userRoleRepo: Repository<UserRole>;
  private rolePermissionRepo: Repository<RolePermission>;
  private userRepo: Repository<User>;

  constructor() {
    this.roleRepo = AppDataSource.getRepository(Role);
    this.permissionRepo = AppDataSource.getRepository(Permission);
    this.userRoleRepo = AppDataSource.getRepository(UserRole);
    this.rolePermissionRepo = AppDataSource.getRepository(RolePermission);
    this.userRepo = AppDataSource.getRepository(User);
  }

  /**
   * Check if user has specific permissions
   */
  async hasPermission(
    userId: string, 
    permissions: string | string[], 
    options: PermissionCheckOptions = {}
  ): Promise<boolean> {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    const userPermissions = await this.getUserPermissions(userId, options.organizationId);

    if (!userPermissions) {
      return false;
    }

    // System admins can do anything unless explicitly restricted
    if (options.allowSystemOverride !== false && userPermissions.isSystemAdmin) {
      this.logger.debug('Permission granted via system admin override', { 
        userId, 
        permissions: requiredPermissions 
      });
      return true;
    }

    const hasPermissions = this.checkPermissionsInList(
      requiredPermissions,
      userPermissions.permissions,
      options.requireAll || false
    );

    this.logger.debug('Permission check result', {
      userId,
      requiredPermissions,
      userPermissions: userPermissions.permissions.slice(0, 10), // Log first 10 for brevity
      hasPermissions,
      isSystemAdmin: userPermissions.isSystemAdmin
    });

    return hasPermissions;
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string, organizationId?: string): Promise<UserPermissions | null> {
    try {
      // Get user with active roles
      const userRoles = await this.userRoleRepo.find({
        where: {
          userId,
          isActive: true,
          deletedAt: IsNull()
        },
        relations: ['role', 'role.permissions', 'role.permissions.permission', 'organization'],
      });

      if (!userRoles.length) {
        this.logger.debug('No active roles found for user', { userId });
        return null;
      }

      // Filter roles based on organization context
      const relevantRoles = userRoles.filter(userRole => {
        // Include system roles (no organization restriction)
        if (userRole.role.type === RoleType.SYSTEM) {
          return true;
        }
        
        // Include organization roles if they match the context or no context specified
        if (userRole.role.type === RoleType.ORGANIZATION) {
          return !organizationId || userRole.organizationId === organizationId;
        }
        
        return false;
      });

      // Extract unique permissions from all relevant roles
      const permissionSet = new Set<string>();
      let isSystemAdmin = false;
      let canCrossOrganizations = false;

      for (const userRole of relevantRoles) {
        const role = userRole.role;
        
        // Check if this is a system admin role
        if (role.isSystemAdmin) {
          isSystemAdmin = true;
        }
        
        // Check if user can access multiple organizations
        if (role.canCrossOrganizations) {
          canCrossOrganizations = true;
        }

        // Add role permissions
        for (const rolePermission of role.permissions) {
          if (rolePermission.isActive && rolePermission.permission.isActive) {
            permissionSet.add(rolePermission.permission.key);
          }
        }
      }

      const permissions = Array.from(permissionSet);

      this.logger.debug('User permissions resolved', {
        userId,
        organizationId,
        permissionCount: permissions.length,
        roleCount: relevantRoles.length,
        isSystemAdmin,
        canCrossOrganizations
      });

      return {
        permissions,
        roles: relevantRoles.map(ur => ({
          role: ur.role,
          organizationId: ur.organizationId,
          isExpired: ur.isExpired
        })),
        isSystemAdmin,
        canCrossOrganizations
      };

    } catch (error: any) {
      this.logger.error('Failed to get user permissions', {
        error: error.message,
        userId,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(
    userId: string,
    roleKey: string,
    organizationId?: string,
    grantedBy?: string,
    expirationDays?: number
  ): Promise<UserRole> {
    try {
      // Validate user exists
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw createNotFoundError('User not found', userId);
      }

      // Get role by key
      const role = await this.roleRepo.findOne({ 
        where: { key: roleKey, isActive: true } 
      });
      if (!role) {
        throw createNotFoundError('Role not found', roleKey);
      }

      // Validate organization context
      if (role.type === RoleType.ORGANIZATION && !organizationId) {
        throw createValidationError('Organization ID required for organization role');
      }
      if (role.type === RoleType.SYSTEM && organizationId) {
        throw createValidationError('Organization ID not allowed for system role');
      }

      // Check if user already has this role
      const existingUserRole = await this.userRoleRepo.findOne({
        where: {
          userId,
          roleId: role.id,
          organizationId: organizationId || undefined,
          isActive: true
        }
      });

      if (existingUserRole) {
        this.logger.warn('User already has this role', {
          userId,
          roleKey,
          organizationId
        });
        return existingUserRole;
      }

      // Create new user role
      const userRole = role.type === RoleType.SYSTEM 
        ? UserRole.createSystemRole(userId, role.id, grantedBy || userId)
        : UserRole.createOrganizationRole(userId, role.id, organizationId!, grantedBy || userId, expirationDays);

      const savedUserRole = await this.userRoleRepo.save(userRole);

      // Synchronize back to legacy role system for compatibility
      if (organizationId) {
        await this.syncUserLegacyRole(userId, organizationId);
      }

      this.logger.info('Role assigned to user', {
        userId,
        roleKey,
        organizationId,
        grantedBy,
        expirationDays
      });

      return savedUserRole;

    } catch (error: any) {
      this.logger.error('Failed to assign role', {
        error: error.message,
        userId,
        roleKey,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(
    userId: string,
    roleKey: string,
    organizationId?: string
  ): Promise<void> {
    try {
      const role = await this.roleRepo.findOne({ 
        where: { key: roleKey, isActive: true } 
      });
      if (!role) {
        throw createNotFoundError('Role not found', roleKey);
      }

      const userRole = await this.userRoleRepo.findOne({
        where: {
          userId,
          roleId: role.id,
          organizationId: organizationId || undefined,
          isActive: true
        }
      });

      if (!userRole) {
        this.logger.warn('User role not found for removal', {
          userId,
          roleKey,
          organizationId
        });
        return;
      }

      userRole.revokeRole();
      await this.userRoleRepo.save(userRole);

      this.logger.info('Role removed from user', {
        userId,
        roleKey,
        organizationId
      });

    } catch (error: any) {
      this.logger.error('Failed to remove role', {
        error: error.message,
        userId,
        roleKey,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Get user's roles in an organization
   */
  async getUserRoles(userId: string, organizationId?: string): Promise<UserRole[]> {
    const whereConditions: any = {
      userId,
      isActive: true,
      deletedAt: null
    };

    if (organizationId) {
      whereConditions.organizationId = organizationId;
    }

    return this.userRoleRepo.find({
      where: whereConditions,
      relations: ['role', 'organization'],
      order: { grantedAt: 'DESC' }
    });
  }

  /**
   * Get user's highest role in an organization (for legacy compatibility)
   */
  async getUserHighestRole(userId: string, organizationId?: string): Promise<string | null> {
    const userRoles = await this.getUserRoles(userId, organizationId);
    
    if (!userRoles.length) {
      return null;
    }

    // Use role priority from database directly - no mapping needed
    const rolePriority: Record<string, number> = {
      'super_admin': 1000,
      'admin': 900, // system admin role (renamed from system_admin)
      'support': 800, // support role (renamed from support_agent)  
      'owner': 700,
      'org_admin': 600, // organization admin role
      'manager': 500,
      'member': 400,
      'viewer': 300,
      'client': 200
    };

    let highestRole: string | null = null;
    let highestPriority = 0;

    for (const userRole of userRoles) {
      const roleKey = userRole.role.key;
      const priority = rolePriority[roleKey] || 0;
      
      if (priority > highestPriority) {
        highestPriority = priority;
        highestRole = roleKey;
      }
    }

    // Return role name directly - no legacy mapping needed
    return highestRole;
  }

  /**
   * Synchronize RBAC roles back to legacy User.role field
   * This ensures compatibility with existing frontend code
   */
  async syncUserLegacyRole(userId: string, organizationId: string): Promise<void> {
    try {
      const highestRole = await this.getUserHighestRole(userId, organizationId);
      
      if (highestRole) {
        await this.userRepo.update(userId, {
          role: highestRole as any
        });

        this.logger.debug('Synchronized legacy role for user', {
          userId,
          organizationId,
          newRole: highestRole
        });
      }
    } catch (error: any) {
      this.logger.error('Failed to sync legacy role', {
        error: error.message,
        userId,
        organizationId
      });
      throw error;
    }
  }

  /**
   * Check if user can manage another user (for role assignments)
   */
  async canManageUser(
    managerId: string,
    targetUserId: string,
    organizationId?: string
  ): Promise<boolean> {
    // System admins can manage anyone
    if (await this.hasPermission(managerId, 'system:cross_tenant')) {
      return true;
    }

    // Organization owners/admins can manage users in their org
    if (organizationId) {
      const canManage = await this.hasPermission(
        managerId, 
        ['user:manage', 'user:assign_roles'], 
        { 
          requireAll: false, 
          organizationId,
          allowSystemOverride: true 
        }
      );
      
      if (canManage) {
        // Verify target user is in the same organization
        const targetUserRoles = await this.getUserRoles(targetUserId, organizationId);
        return targetUserRoles.length > 0;
      }
    }

    return false;
  }

  /**
   * Initialize default roles and permissions
   */
  async initializeRBACSystem(): Promise<void> {
    this.logger.info('Initializing RBAC system...');

    try {
      // Create permissions
      await this.createDefaultPermissions();
      
      // Create roles
      await this.createDefaultRoles();
      
      // Assign permissions to roles
      await this.assignDefaultPermissions();

      this.logger.info('RBAC system initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize RBAC system', { error: error.message });
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private checkPermissionsInList(
    required: string[],
    userPermissions: string[],
    requireAll: boolean
  ): boolean {
    const checkPermission = (permission: string): boolean => {
      // Direct match
      if (userPermissions.includes(permission)) {
        return true;
      }

      // Wildcard match
      return userPermissions.some(userPerm => 
        Permission.matchesWildcard(permission, userPerm)
      );
    };

    return requireAll
      ? required.every(checkPermission)
      : required.some(checkPermission);
  }

  private async createDefaultPermissions(): Promise<void> {
    const defaultPermissions = Permission.getDefaultPermissions();
    
    for (const permData of defaultPermissions) {
      const existing = await this.permissionRepo.findOne({ 
        where: { key: permData.key } 
      });
      
      if (!existing) {
        const permission = this.permissionRepo.create(permData);
        await this.permissionRepo.save(permission);
        this.logger.debug('Created permission', { key: permData.key });
      }
    }
  }

  private async createDefaultRoles(): Promise<void> {
    const defaultRoles = [
      // System roles
      {
        key: SystemRoleKey.SUPER_ADMIN,
        name: 'Super Administrator',
        description: 'Full system access across all organizations',
        type: RoleType.SYSTEM,
        isSystemRole: true,
        priority: 1000
      },
      {
        key: SystemRoleKey.ADMIN,
        name: 'Admin',
        description: 'Technical system administration',
        type: RoleType.SYSTEM,
        isSystemRole: true,
        priority: 900
      },
      {
        key: SystemRoleKey.SUPPORT,
        name: 'Support',
        description: 'Customer support access',
        type: RoleType.SYSTEM,
        isSystemRole: true,
        priority: 800
      },
      // Organization roles
      {
        key: OrganizationRoleKey.OWNER,
        name: 'Organization Owner',
        description: 'Full control over organization',
        type: RoleType.ORGANIZATION,
        isSystemRole: false,
        priority: 700
      },
      {
        key: OrganizationRoleKey.ORG_ADMIN,
        name: 'Organization Administrator',
        description: 'Administrative access within organization',
        type: RoleType.ORGANIZATION,
        isSystemRole: false,
        priority: 600
      },
      {
        key: OrganizationRoleKey.MANAGER,
        name: 'Manager',
        description: 'Invoice and payment management',
        type: RoleType.ORGANIZATION,
        isSystemRole: false,
        priority: 500
      },
      {
        key: OrganizationRoleKey.MEMBER,
        name: 'Member',
        description: 'Standard user access',
        type: RoleType.ORGANIZATION,
        isSystemRole: false,
        priority: 400
      },
      {
        key: OrganizationRoleKey.VIEWER,
        name: 'Viewer',
        description: 'Read-only access',
        type: RoleType.ORGANIZATION,
        isSystemRole: false,
        priority: 300
      },
      {
        key: OrganizationRoleKey.CLIENT,
        name: 'Client',
        description: 'External client access',
        type: RoleType.ORGANIZATION,
        isSystemRole: false,
        priority: 200
      }
    ];

    for (const roleData of defaultRoles) {
      const existing = await this.roleRepo.findOne({ 
        where: { key: roleData.key } 
      });
      
      if (!existing) {
        const role = this.roleRepo.create(roleData);
        await this.roleRepo.save(role);
        this.logger.debug('Created role', { key: roleData.key });
      }
    }
  }

  private async assignDefaultPermissions(): Promise<void> {
    const roles = await this.roleRepo.find({ where: { isActive: true } });
    const permissions = await this.permissionRepo.find({ where: { isActive: true } });
    
    for (const role of roles) {
      const defaultPermissionKeys = Role.getDefaultPermissionsForRole(role.key);
      
      for (const permissionKey of defaultPermissionKeys) {
        let matchingPermissions: Permission[] = [];
        
        // Handle wildcard permissions
        if (permissionKey.endsWith(':*')) {
          const prefix = permissionKey.replace(':*', ':');
          matchingPermissions = permissions.filter(p => p.key.startsWith(prefix));
        } else {
          const permission = permissions.find(p => p.key === permissionKey);
          if (permission) {
            matchingPermissions = [permission];
          }
        }
        
        // Create role-permission mappings
        for (const permission of matchingPermissions) {
          const existing = await this.rolePermissionRepo.findOne({
            where: { roleId: role.id, permissionId: permission.id }
          });
          
          if (!existing) {
            const rolePermission = RolePermission.create(role.id, permission.id);
            await this.rolePermissionRepo.save(rolePermission);
          }
        }
      }
      
      this.logger.debug('Assigned permissions to role', { 
        roleKey: role.key, 
        permissionCount: defaultPermissionKeys.length 
      });
    }
  }
}