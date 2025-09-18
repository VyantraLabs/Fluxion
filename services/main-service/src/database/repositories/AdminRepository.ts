import { Repository, SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Logger } from '../../shared/utils/logger';
import { User } from '../entities/User';
import { Organization } from '../entities/Organization';
import { Invoice } from '../entities/Invoice';
import { Payment } from '../entities/Payment';
import { AuditLog } from '../entities/AuditLog';
import { SystemSettings } from '../entities/SystemSettings';
import { Template } from '../entities/Template';
import { UserRole } from '../entities/UserRole';
import { Role, SystemRoleKey } from '../entities/Role';

export interface SystemStats {
  users: {
    total: number;
    active: number;
    adminUsers: number;
    superAdminUsers: number;
    thisMonth: number;
  };
  organizations: {
    total: number;
    active: number;
    thisMonth: number;
  };
  invoices: {
    total: number;
    thisMonth: number;
    totalValue: string;
    thisMonthValue: string;
    averageValue: string;
  };
  payments: {
    total: number;
    thisMonth: number;
    totalValue: string;
    thisMonthValue: string;
    successRate: number;
  };
  templates: {
    system: number;
    organizational: number;
    active: number;
    totalUsage: number;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    lastUpdated: string;
    issues: string[];
  };
}

export interface OrganizationWithStats {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  invoiceCount: number;
  templateCount: number;
  totalPayments: string;
  lastActivity: Date;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
}

export interface UserWithStats {
  id: string;
  email: string;
  walletAddress?: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  roles: Array<{
    key: string;
    type: string;
    organizationId?: string;
  }>;
  isActive: boolean;
  organizationName: string;
  invoiceCount: number;
  totalPayments: string;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  tableName: string;
  displayAction: string;
  displayTableName: string;
  userDisplayName: string;
  organizationName: string;
  isHighRisk: boolean;
  adminAction: boolean;
  severityLevel: string;
  ipAddress?: string;
  createdAt: Date;
  summary: string;
}

export class AdminRepository {
  private userRepository: Repository<User>;
  private organizationRepository: Repository<Organization>;
  private invoiceRepository: Repository<Invoice>;
  private paymentRepository: Repository<Payment>;
  private auditLogRepository: Repository<AuditLog>;
  private systemSettingsRepository: Repository<SystemSettings>;
  private templateRepository: Repository<Template>;
  private userRoleRepository: Repository<UserRole>;
  private roleRepository: Repository<Role>;
  private logger: Logger;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.invoiceRepository = AppDataSource.getRepository(Invoice);
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.auditLogRepository = AppDataSource.getRepository(AuditLog);
    this.systemSettingsRepository = AppDataSource.getRepository(SystemSettings);
    this.templateRepository = AppDataSource.getRepository(Template);
    this.userRoleRepository = AppDataSource.getRepository(UserRole);
    this.roleRepository = AppDataSource.getRepository(Role);
    this.logger = new Logger('AdminRepository');
  }

  /**
   * Get comprehensive system statistics
   */
  async getSystemStats(): Promise<SystemStats> {
    this.logger.info('Fetching system statistics');

    try {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      
      // Parallel queries for better performance
      const [
        userStats,
        organizationStats,
        invoiceStats,
        paymentStats,
        templateStats
      ] = await Promise.all([
        this.getUserStats(startOfMonth),
        this.getOrganizationStats(startOfMonth),
        this.getInvoiceStats(startOfMonth),
        this.getPaymentStats(startOfMonth),
        this.getTemplateStats()
      ]);

      const systemHealth = await this.getSystemHealth();

      const stats: SystemStats = {
        users: userStats,
        organizations: organizationStats,
        invoices: invoiceStats,
        payments: paymentStats,
        templates: templateStats,
        systemHealth
      };

      this.logger.info('System statistics fetched successfully', {
        totalUsers: userStats.total,
        totalOrganizations: organizationStats.total,
        totalInvoices: invoiceStats.total
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to fetch system statistics', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get all organizations with statistics
   */
  async getAllOrganizationsWithStats(
    limit: number = 50,
    offset: number = 0,
    searchTerm?: string,
    status?: 'active' | 'inactive' | 'suspended'
  ): Promise<{ organizations: OrganizationWithStats[]; total: number }> {
    this.logger.info('Fetching organizations with stats', { limit, offset, searchTerm, status });

    try {
      let query = this.organizationRepository
        .createQueryBuilder('org')
        .leftJoinAndSelect('org.users', 'user')
        .leftJoin('user.invoices', 'invoice')
        .leftJoin('user.templates', 'template')
        .leftJoin('invoice.payments', 'payment')
        .select([
          'org.id',
          'org.name',
          'org.slug',
          'org.createdAt',
          'COUNT(DISTINCT user.id) as userCount',
          'COUNT(DISTINCT invoice.id) as invoiceCount',
          'COUNT(DISTINCT template.id) as templateCount',
          'COALESCE(SUM(CASE WHEN payment.status = \'completed\' THEN payment.amount ELSE 0 END), 0) as totalPayments',
          'MAX(user.lastLoginAt) as lastActivity'
        ])
        .groupBy('org.id');

      if (searchTerm) {
        query = query.where('org.name ILIKE :search OR org.slug ILIKE :search', {
          search: `%${searchTerm}%`
        });
      }

      if (status) {
        // Assuming we add a status field to organizations later
        // query = query.andWhere('org.status = :status', { status });
      }

      const [results, total] = await Promise.all([
        query
          .orderBy('org.createdAt', 'DESC')
          .limit(limit)
          .offset(offset)
          .getRawMany(),
        query.getCount()
      ]);

      const organizations: OrganizationWithStats[] = results.map(row => ({
        id: row.org_id,
        name: row.org_name,
        slug: row.org_slug,
        userCount: parseInt(row.usercount) || 0,
        invoiceCount: parseInt(row.invoicecount) || 0,
        templateCount: parseInt(row.templatecount) || 0,
        totalPayments: row.totalpayments || '0',
        lastActivity: row.lastactivity || row.org_createdAt,
        status: 'active', // Default for now
        createdAt: row.org_createdAt
      }));

      this.logger.info('Organizations with stats fetched successfully', {
        count: organizations.length,
        total
      });

      return { organizations, total };
    } catch (error: any) {
      this.logger.error('Failed to fetch organizations with stats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all users across organizations with statistics
   */
  async getAllUsersWithStats(
    limit: number = 50,
    offset: number = 0,
    searchTerm?: string,
    organizationId?: string,
    adminOnly?: boolean
  ): Promise<{ users: UserWithStats[]; total: number }> {
    this.logger.info('Fetching users with stats', { limit, offset, searchTerm, organizationId, adminOnly });

    try {
      let query = this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.organization', 'org')
        .leftJoin('user.invoices', 'invoice')
        .leftJoin('invoice.payments', 'payment', 'payment.status = :paymentStatus', { paymentStatus: 'completed' })
        .leftJoin('user.userRoles', 'userRole', 'userRole.isActive = true')
        .leftJoin('userRole.role', 'role')
        .select([
          'user.id',
          'user.email',
          'user.walletAddress',
          'user.firstName',
          'user.lastName',
          'user.isActive',
          'user.lastLoginAt',
          'user.createdAt',
          'org.name as organizationName',
          'COUNT(DISTINCT invoice.id) as invoiceCount',
          'COALESCE(SUM(payment.amount), 0) as totalPayments'
        ])
        .groupBy('user.id, org.name');

      if (searchTerm) {
        query = query.where(
          'user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.walletAddress ILIKE :search',
          { search: `%${searchTerm}%` }
        );
      }

      if (organizationId) {
        query = query.andWhere('user.organizationId = :organizationId', { organizationId });
      }

      if (adminOnly) {
        // Filter for users with admin or super admin roles
        query = query.andWhere(
          '(role.key IN (:...adminRoles) AND userRole.organizationId IS NULL)',
          { adminRoles: ['admin', 'super_admin'] }
        );
      }

      const [results, total] = await Promise.all([
        query
          .orderBy('user.createdAt', 'DESC')
          .limit(limit)
          .offset(offset)
          .getRawMany(),
        query.getCount()
      ]);

      // Get user roles separately for each user
      const userIds = results.map(row => row.user_id);
      const userRolesQuery = await this.userRoleRepository
        .createQueryBuilder('userRole')
        .leftJoinAndSelect('userRole.role', 'role')
        .where('userRole.userId IN (:...userIds)', { userIds })
        .andWhere('userRole.isActive = true')
        .getMany();

      // Group roles by user ID
      const rolesByUserId = userRolesQuery.reduce((acc: any, userRole: any) => {
        if (!acc[userRole.userId]) {
          acc[userRole.userId] = [];
        }
        acc[userRole.userId].push({
          key: userRole.role.key,
          type: userRole.role.type,
          organizationId: userRole.organizationId
        });
        return acc;
      }, {});

      const users: UserWithStats[] = results.map(row => ({
        id: row.user_id,
        email: row.user_email,
        walletAddress: row.user_walletAddress,
        firstName: row.user_firstName,
        lastName: row.user_lastName,
        displayName: `${row.user_firstName || ''} ${row.user_lastName || ''}`.trim() || row.user_email,
        roles: rolesByUserId[row.user_id] || [],
        isActive: row.user_isActive,
        organizationName: row.organizationname || 'Unknown',
        invoiceCount: parseInt(row.invoicecount) || 0,
        totalPayments: row.totalpayments || '0',
        lastLoginAt: row.user_lastLoginAt,
        createdAt: row.user_createdAt
      }));

      this.logger.info('Users with stats fetched successfully', {
        count: users.length,
        total
      });

      return { users, total };
    } catch (error: any) {
      this.logger.error('Failed to fetch users with stats', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get activity logs for admin dashboard
   */
  async getActivityLogs(
    limit: number = 100,
    offset: number = 0,
    filters: {
      adminOnly?: boolean;
      highRiskOnly?: boolean;
      userId?: string;
      organizationId?: string;
      action?: string;
      tableName?: string;
      severityLevel?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    this.logger.info('Fetching activity logs', { limit, offset, filters });

    try {
      let query = this.auditLogRepository
        .createQueryBuilder('audit')
        .leftJoin('audit.user', 'user')
        .leftJoin('audit.organization', 'org')
        .select([
          'audit.id',
          'audit.action',
          'audit.tableName',
          'audit.adminAction',
          'audit.severityLevel',
          'audit.ipAddress',
          'audit.createdAt',
          'audit.metadata',
          'user.email',
          'user.firstName',
          'user.lastName',
          'org.name as organizationName'
        ]);

      if (filters.adminOnly) {
        query = query.where('audit.adminAction = true');
      }

      if (filters.highRiskOnly) {
        query = query.andWhere(
          '(audit.adminAction = true OR audit.severityLevel IN (\'high\', \'critical\') OR audit.action IN (\'DELETE\', \'EXPORT\'))'
        );
      }

      if (filters.userId) {
        query = query.andWhere('audit.userId = :userId', { userId: filters.userId });
      }

      if (filters.organizationId) {
        query = query.andWhere('audit.organizationId = :organizationId', { organizationId: filters.organizationId });
      }

      if (filters.action) {
        query = query.andWhere('audit.action = :action', { action: filters.action });
      }

      if (filters.tableName) {
        query = query.andWhere('audit.tableName = :tableName', { tableName: filters.tableName });
      }

      if (filters.severityLevel) {
        query = query.andWhere('audit.severityLevel = :severityLevel', { severityLevel: filters.severityLevel });
      }

      if (filters.startDate) {
        query = query.andWhere('audit.createdAt >= :startDate', { startDate: filters.startDate });
      }

      if (filters.endDate) {
        query = query.andWhere('audit.createdAt <= :endDate', { endDate: filters.endDate });
      }

      const [results, total] = await Promise.all([
        query
          .orderBy('audit.createdAt', 'DESC')
          .limit(limit)
          .offset(offset)
          .getRawMany(),
        query.getCount()
      ]);

      const logs: ActivityLogEntry[] = results.map(row => {
        const userDisplayName = `${row.user_firstName || ''} ${row.user_lastName || ''}`.trim() 
          || row.user_email 
          || 'System';
        
        return {
          id: row.audit_id,
          action: row.audit_action,
          tableName: row.audit_tableName,
          displayAction: this.formatDisplayAction(row.audit_action),
          displayTableName: this.formatDisplayTableName(row.audit_tableName),
          userDisplayName,
          organizationName: row.organizationname || 'System',
          isHighRisk: this.isHighRiskAction(row),
          adminAction: row.audit_adminAction,
          severityLevel: row.audit_severityLevel,
          ipAddress: row.audit_ipAddress,
          createdAt: row.audit_createdAt,
          summary: this.generateLogSummary(row, userDisplayName)
        };
      });

      this.logger.info('Activity logs fetched successfully', {
        count: logs.length,
        total
      });

      return { logs, total };
    } catch (error: any) {
      this.logger.error('Failed to fetch activity logs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update user admin status
   * @deprecated This method is deprecated. Use RBAC service methods instead.
   */
  async updateUserAdminStatus(
    userId: string,
    isAdmin: boolean,
    isSuperAdmin: boolean = false,
    grantedBy: string
  ): Promise<User> {
    this.logger.warn('DEPRECATED: updateUserAdminStatus called. Use RBAC service instead.', { 
      userId, isAdmin, isSuperAdmin, grantedBy 
    });

    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      // TODO: Replace with RBAC service calls
      // This is a temporary stub while migrating to RBAC system
      this.logger.info('TEMP: Admin status update stubbed for RBAC migration', { 
        userId, 
        requestedAdmin: isAdmin, 
        requestedSuperAdmin: isSuperAdmin 
      });

      return user;
    } catch (error: any) {
      this.logger.error('Failed to update user admin status', {
        error: error.message,
        userId,
        isAdmin,
        isSuperAdmin
      });
      throw error;
    }
  }

  /**
   * Get system settings
   */
  async getSystemSettings(category?: string, publicOnly?: boolean): Promise<SystemSettings[]> {
    this.logger.info('Fetching system settings', { category, publicOnly });

    try {
      let query = this.systemSettingsRepository.createQueryBuilder('settings');

      if (category) {
        query = query.where('settings.category = :category', { category });
      }

      if (publicOnly) {
        query = query.andWhere('settings.isPublic = true');
      }

      const settings = await query
        .orderBy('settings.category', 'ASC')
        .addOrderBy('settings.key', 'ASC')
        .getMany();

      this.logger.info('System settings fetched successfully', {
        count: settings.length,
        category,
        publicOnly
      });

      return settings;
    } catch (error: any) {
      this.logger.error('Failed to fetch system settings', {
        error: error.message,
        category,
        publicOnly
      });
      throw error;
    }
  }

  /**
   * Update system setting
   */
  async updateSystemSetting(
    key: string,
    value: any,
    updatedBy: string,
    description?: string
  ): Promise<SystemSettings> {
    this.logger.info('Updating system setting', { key, updatedBy });

    try {
      let setting = await this.systemSettingsRepository.findOne({ where: { key } });
      
      if (!setting) {
        // Create new setting if it doesn't exist
        setting = this.systemSettingsRepository.create({
          key,
          value,
          description,
          updatedBy
        });
      } else {
        const oldValue = setting.value;
        setting.setValue(value, updatedBy);
        if (description) {
          setting.description = description;
        }

        // Create audit log for setting change
        const auditData = AuditLog.createForSystemOperation(
          updatedBy,
          'update_system_setting',
          {
            key,
            oldValue,
            newValue: value,
            description
          },
          'high'
        );

        await this.auditLogRepository.save(auditData);
      }

      const updatedSetting = await this.systemSettingsRepository.save(setting);

      this.logger.info('System setting updated successfully', {
        key: updatedSetting.key,
        updatedBy
      });

      return updatedSetting;
    } catch (error: any) {
      this.logger.error('Failed to update system setting', {
        error: error.message,
        key,
        updatedBy
      });
      throw error;
    }
  }

  // Private helper methods
  private async getUserStats(startOfMonth: Date) {
    const [total, active, adminCount, superAdminCount, thisMonth] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      // Count users with admin system roles using RBAC
      this.userRoleRepository
        .createQueryBuilder('userRole')
        .leftJoin('userRole.role', 'role')
        .where('role.key = :adminKey', { adminKey: SystemRoleKey.ADMIN })
        .andWhere('userRole.isActive = true')
        .andWhere('userRole.organizationId IS NULL') // System roles only
        .getCount(),
      // Count users with super admin system roles using RBAC
      this.userRoleRepository
        .createQueryBuilder('userRole')
        .leftJoin('userRole.role', 'role')
        .where('role.key = :superAdminKey', { superAdminKey: SystemRoleKey.SUPER_ADMIN })
        .andWhere('userRole.isActive = true')
        .andWhere('userRole.organizationId IS NULL') // System roles only
        .getCount(),
      this.userRepository.createQueryBuilder('user')
        .where('user.createdAt >= :startOfMonth', { startOfMonth })
        .getCount()
    ]);

    return {
      total,
      active,
      adminUsers: adminCount,
      superAdminUsers: superAdminCount,
      thisMonth
    };
  }

  private async getOrganizationStats(startOfMonth: Date) {
    const [total, thisMonth] = await Promise.all([
      this.organizationRepository.count(),
      this.organizationRepository.createQueryBuilder('org')
        .where('org.createdAt >= :startOfMonth', { startOfMonth })
        .getCount()
    ]);

    return {
      total,
      active: total, // Assuming all orgs are active for now
      thisMonth
    };
  }

  private async getInvoiceStats(startOfMonth: Date) {
    const totalQuery = this.invoiceRepository.createQueryBuilder('invoice')
      .select([
        'COUNT(*) as total',
        'SUM(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount ELSE 0 END) as totalValue',
        'AVG(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount ELSE NULL END) as averageValue'
      ])
      .getRawOne();

    const thisMonthQuery = this.invoiceRepository.createQueryBuilder('invoice')
      .select([
        'COUNT(*) as thisMonth',
        'SUM(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount ELSE 0 END) as thisMonthValue'
      ])
      .where('invoice.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne();

    const [totalStats, monthStats] = await Promise.all([totalQuery, thisMonthQuery]);

    return {
      total: parseInt(totalStats.total) || 0,
      thisMonth: parseInt(monthStats.thismonth) || 0,
      totalValue: totalStats.totalvalue || '0',
      thisMonthValue: monthStats.thismonthvalue || '0',
      averageValue: totalStats.averagevalue || '0'
    };
  }

  private async getPaymentStats(startOfMonth: Date) {
    const totalQuery = this.paymentRepository.createQueryBuilder('payment')
      .select([
        'COUNT(*) as total',
        'SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount ELSE 0 END) as totalValue',
        'COUNT(CASE WHEN payment.status = \'completed\' THEN 1 END) as successful'
      ])
      .getRawOne();

    const thisMonthQuery = this.paymentRepository.createQueryBuilder('payment')
      .select([
        'COUNT(*) as thisMonth',
        'SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount ELSE 0 END) as thisMonthValue'
      ])
      .where('payment.createdAt >= :startOfMonth', { startOfMonth })
      .getRawOne();

    const [totalStats, monthStats] = await Promise.all([totalQuery, thisMonthQuery]);

    const total = parseInt(totalStats.total) || 0;
    const successful = parseInt(totalStats.successful) || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return {
      total,
      thisMonth: parseInt(monthStats.thismonth) || 0,
      totalValue: totalStats.totalvalue || '0',
      thisMonthValue: monthStats.thismonthvalue || '0',
      successRate: Math.round(successRate * 100) / 100
    };
  }

  private async getTemplateStats() {
    const [system, organizational, active, totalUsage] = await Promise.all([
      this.templateRepository.createQueryBuilder('template')
        .where('template.organizationId IS NULL')
        .getCount(),
      this.templateRepository.createQueryBuilder('template')
        .where('template.organizationId IS NOT NULL')
        .getCount(),
      this.templateRepository.count({ where: { isActive: true } }),
      this.templateRepository.count() // Placeholder for usage stats
    ]);

    return {
      system,
      organizational,
      active,
      totalUsage
    };
  }

  private async getSystemHealth() {
    // Basic system health check
    const issues: string[] = [];
    
    try {
      // Check database connectivity
      await this.userRepository.count();
    } catch (error) {
      issues.push('Database connectivity issue');
    }

    const status = issues.length === 0 ? 'healthy' : issues.length < 3 ? 'degraded' : 'critical';

    return {
      status: status as 'healthy' | 'degraded' | 'critical',
      uptime: process.uptime(),
      lastUpdated: new Date().toISOString(),
      issues
    };
  }

  private formatDisplayAction(action: string): string {
    const actionMap: Record<string, string> = {
      'CREATE': 'Created',
      'UPDATE': 'Updated', 
      'DELETE': 'Deleted',
      'LOGIN': 'Logged In',
      'LOGOUT': 'Logged Out',
      'EXPORT': 'Exported',
      'IMPORT': 'Imported',
    };
    return actionMap[action] || action;
  }

  private formatDisplayTableName(tableName: string | undefined | null): string {
    if (!tableName || typeof tableName !== 'string') {
      return 'Unknown';
    }
    
    return tableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isHighRiskAction(row: any): boolean {
    const highRiskActions = ['DELETE', 'EXPORT'];
    const highRiskTables = ['users', 'organization_settings', 'audit_logs'];
    
    return (
      row.audit_adminAction ||
      highRiskActions.includes(row.audit_action) ||
      highRiskTables.includes(row.audit_tableName) ||
      ['high', 'critical'].includes(row.audit_severityLevel)
    );
  }

  private generateLogSummary(row: any, userDisplayName: string): string {
    const action = this.formatDisplayAction(row.audit_action).toLowerCase();
    const table = this.formatDisplayTableName(row.audit_tableName).toLowerCase();
    
    switch (row.audit_action) {
      case 'CREATE':
        return `${userDisplayName} created a new ${table}`;
      case 'UPDATE':
        return `${userDisplayName} updated ${table}`;
      case 'DELETE':
        return `${userDisplayName} deleted ${table}`;
      case 'LOGIN':
        return `${userDisplayName} logged in`;
      case 'LOGOUT':
        return `${userDisplayName} logged out`;
      case 'EXPORT':
        return `${userDisplayName} exported ${table} data`;
      case 'IMPORT':
        return `${userDisplayName} imported ${table} data`;
      default:
        return `${userDisplayName} performed ${action} on ${table}`;
    }
  }
}