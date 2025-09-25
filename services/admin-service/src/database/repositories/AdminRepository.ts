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
    lastMonth: number;
    thisWeek: number;
    thisYear: number;
    growthRate: number;
    activeRate: number;
  };
  organizations: {
    total: number;
    active: number;
    thisMonth: number;
    lastMonth: number;
    thisWeek: number;
    growthRate: number;
    averageUsersPerOrg: number;
  };
  invoices: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    thisWeek: number;
    thisYear: number;
    totalValue: string;
    thisMonthValue: string;
    lastMonthValue?: string;
    averageValue: string;
    completedRate: number;
    growthRate: number;
  };
  payments: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    thisWeek: number;
    thisYear: number;
    totalValue: string;
    thisMonthValue: string;
    lastMonthValue?: string;
    successRate: number;
    averageAmount: string;
    growthRate: number;
  };
  templates: {
    system: number;
    organizational: number;
    active: number;
    thisMonth: number;
    totalUsage: number;
    popularTemplates: Array<{
      id: string;
      name: string;
      usageCount: number;
    }>;
  };
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical';
    uptime: number;
    lastUpdated: string;
    issues: string[];
    performanceScore: number;
  };
  growth?: {
    userGrowthTrend: Array<{ period: string; count: number }>;
    revenueGrowthTrend: Array<{ period: string; amount: string }>;
    organizationGrowthTrend: Array<{ period: string; count: number }>;
  };
  performance?: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    activeConnections: number;
  };
  summary: {
    totalRevenue: string;
    monthlyGrowthRate: number;
    averageInvoiceValue: string;
    conversionRate: number;
    activeUsersRate: number;
  };
}

export interface OrganizationWithStats {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  activeUserCount?: number;
  invoiceCount: number;
  completedInvoiceCount?: number;
  invoicesThisMonth?: number;
  templateCount: number;
  totalPayments: string;
  activityCount?: number;
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
    name: string;
    type: string;
    organizationId?: string;
    organizationName?: string;
    isSystemRole: boolean;
    priority: number;
    assignedAt: Date;
    expiresAt?: Date;
  }>;
  isActive: boolean;
  organizationName: string;
  organizationSlug?: string;
  invoiceCount: number;
  completedInvoiceCount?: number;
  invoicesThisMonth?: number;
  totalPayments: string;
  activityCount?: number;
  systemRoleCount?: number;
  orgRoleCount?: number;
  lastLoginAt?: Date;
  createdAt: Date;
  // Derived fields
  isSystemAdmin?: boolean;
  highestRole?: string;
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  tableName: string;
  recordId?: string;
  displayAction: string;
  displayTableName: string;
  userDisplayName: string;
  userId?: string;
  organizationName: string;
  organizationId?: string;
  organizationSlug?: string;
  isHighRisk: boolean;
  adminAction: boolean;
  severityLevel: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  metadata?: any;
  oldValues?: any;
  newValues?: any;
  summary: string;
  // Enhanced derived fields
  timeAgo?: string;
  riskScore?: number;
  category?: string;
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
   * Get comprehensive system statistics with enhanced metrics
   */
  async getSystemStats(): Promise<SystemStats> {
    this.logger.info('Fetching comprehensive system statistics');

    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      
      // Execute all stat queries in parallel for optimal performance
      const [
        userStats,
        organizationStats,
        invoiceStats,
        paymentStats,
        templateStats,
        growthStats,
        performanceStats
      ] = await Promise.all([
        this.getUserStats(startOfMonth, startOfLastMonth, endOfLastMonth, startOfWeek, startOfYear),
        this.getOrganizationStats(startOfMonth, startOfLastMonth, endOfLastMonth, startOfWeek),
        this.getInvoiceStats(startOfMonth, startOfLastMonth, endOfLastMonth, startOfWeek, startOfYear),
        this.getPaymentStats(startOfMonth, startOfLastMonth, endOfLastMonth, startOfWeek, startOfYear),
        this.getTemplateStats(startOfMonth),
        this.getGrowthStats(startOfMonth, startOfLastMonth, endOfLastMonth, startOfWeek),
        this.getPerformanceStats(startOfWeek)
      ]);

      const systemHealth = await this.getSystemHealth();

      const stats: SystemStats = {
        users: userStats,
        organizations: organizationStats,
        invoices: invoiceStats,
        payments: paymentStats,
        templates: templateStats,
        systemHealth,
        // Enhanced metrics
        growth: growthStats,
        performance: performanceStats,
        summary: {
          totalRevenue: paymentStats.totalValue,
          monthlyGrowthRate: this.calculateGrowthRate(parseFloat(paymentStats.thisMonthValue), parseFloat(paymentStats.lastMonthValue || '0')),
          averageInvoiceValue: invoiceStats.averageValue,
          conversionRate: this.calculateConversionRate(invoiceStats.total, paymentStats.total),
          activeUsersRate: this.calculateActiveUsersRate(userStats.active, userStats.total)
        }
      };

      this.logger.info('System statistics fetched successfully', {
        totalUsers: userStats.total,
        totalOrganizations: organizationStats.total,
        totalInvoices: invoiceStats.total,
        totalRevenue: paymentStats.totalValue,
        monthlyGrowthRate: stats.summary.monthlyGrowthRate
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
        .leftJoin('org.users', 'user', 'user.deletedAt IS NULL')
        .leftJoin('user.invoices', 'invoice', 'invoice.deletedAt IS NULL')
        .leftJoin('user.templates', 'template', 'template.deletedAt IS NULL')
        .leftJoin('invoice.payments', 'payment', 'payment.status = :completedStatus', { completedStatus: 'completed' })
        .leftJoin(
          'audit_logs', 'audit', 
          'audit.organizationId = org.id AND audit.createdAt >= :thirtyDaysAgo',
          { thirtyDaysAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        )
        .select([
          'org.id',
          'org.name',
          'org.slug',
          'org.createdAt',
          'org.updatedAt',
          'COUNT(DISTINCT user.id) as userCount',
          'COUNT(DISTINCT CASE WHEN user.isActive = true THEN user.id END) as activeUserCount',
          'COUNT(DISTINCT invoice.id) as invoiceCount',
          'COUNT(DISTINCT CASE WHEN invoice.status = \'completed\' THEN invoice.id END) as completedInvoiceCount',
          'COUNT(DISTINCT template.id) as templateCount',
          'COALESCE(SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount::decimal ELSE 0 END), 0) as totalPayments',
          'COUNT(DISTINCT CASE WHEN invoice.createdAt >= :thisMonth THEN invoice.id END) as invoicesThisMonth',
          'COUNT(DISTINCT audit.id) as activityCount',
          'MAX(user.lastLoginAt) as lastActivity'
        ])
        .addSelect('org.deletedAt IS NULL as isActive')
        .where('org.deletedAt IS NULL')
        .groupBy('org.id, org.name, org.slug, org.createdAt, org.updatedAt, org.deletedAt')
        .setParameter('thisMonth', new Date(new Date().getFullYear(), new Date().getMonth(), 1));

      if (searchTerm) {
        query = query.andWhere(
          '(org.name ILIKE :search OR org.slug ILIKE :search OR org.description ILIKE :search)',
          { search: `%${searchTerm}%` }
        );
      }

      if (status) {
        switch (status) {
          case 'active':
            query = query.andWhere('org.deletedAt IS NULL');
            break;
          case 'inactive':
          case 'suspended':
            // For now, treat inactive/suspended as soft deleted
            query = query.orWhere('org.deletedAt IS NOT NULL');
            break;
        }
      }

      // Get total count before applying limit/offset
      const countQuery = query.clone();
      const total = await countQuery.getCount();

      const results = await query
        .orderBy('org.createdAt', 'DESC')
        .addOrderBy('org.name', 'ASC')
        .limit(limit)
        .offset(offset)
        .getRawMany();

      const organizations: OrganizationWithStats[] = results.map(row => ({
        id: row.org_id,
        name: row.org_name,
        slug: row.org_slug,
        userCount: parseInt(row.usercount) || 0,
        invoiceCount: parseInt(row.invoicecount) || 0,
        templateCount: parseInt(row.templatecount) || 0,
        totalPayments: row.totalpayments?.toString() || '0',
        lastActivity: row.lastactivity || row.org_createdat,
        status: row.isactive ? 'active' : 'inactive',
        createdAt: row.org_createdat,
        // Add additional fields for enhanced stats
        activeUserCount: parseInt(row.activeusercount) || 0,
        completedInvoiceCount: parseInt(row.completedinvoicecount) || 0,
        invoicesThisMonth: parseInt(row.invoicesthismonth) || 0,
        activityCount: parseInt(row.activitycount) || 0
      }));

      this.logger.info('Organizations with stats fetched successfully', {
        count: organizations.length,
        total,
        searchTerm,
        status
      });

      return { organizations, total };
    } catch (error: any) {
      this.logger.error('Failed to fetch organizations with stats', {
        error: error.message,
        stack: error.stack
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
        .leftJoin('user.invoices', 'invoice', 'invoice.deletedAt IS NULL')
        .leftJoin('invoice.payments', 'payment', 'payment.status = :paymentStatus', { paymentStatus: 'completed' })
        .leftJoin('user.userRoles', 'userRole', 'userRole.isActive = true AND (userRole.expiresAt IS NULL OR userRole.expiresAt > NOW())')
        .leftJoin('userRole.role', 'role')
        .leftJoin(
          'audit_logs', 'audit',
          'audit.userId = user.id AND audit.createdAt >= :thirtyDaysAgo',
          { thirtyDaysAgo: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        )
        .select([
          'user.id',
          'user.email',
          'user.walletAddress',
          'user.firstName',
          'user.lastName',
          'user.isActive',
          'user.lastLoginAt',
          'user.createdAt',
          'user.updatedAt',
          'user.organizationId',
          'org.name as organizationName',
          'org.slug as organizationSlug',
          'COUNT(DISTINCT invoice.id) as invoiceCount',
          'COUNT(DISTINCT CASE WHEN invoice.status = \'completed\' THEN invoice.id END) as completedInvoiceCount',
          'COUNT(DISTINCT CASE WHEN invoice.createdAt >= :thisMonth THEN invoice.id END) as invoicesThisMonth',
          'COALESCE(SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount::decimal ELSE 0 END), 0) as totalPayments',
          'COUNT(DISTINCT audit.id) as activityCount',
          'COUNT(DISTINCT CASE WHEN userRole.organizationId IS NULL AND role.key IN (:...adminRoles) THEN userRole.id END) as systemRoleCount',
          'COUNT(DISTINCT CASE WHEN userRole.organizationId IS NOT NULL THEN userRole.id END) as orgRoleCount'
        ])
        .where('user.deletedAt IS NULL')
        .groupBy('user.id, user.email, user.walletAddress, user.firstName, user.lastName, user.isActive, user.lastLoginAt, user.createdAt, user.updatedAt, user.organizationId, org.name, org.slug')
        .setParameter('thisMonth', new Date(new Date().getFullYear(), new Date().getMonth(), 1))
        .setParameter('adminRoles', ['admin', 'super_admin', 'system_admin']);

      if (searchTerm) {
        query = query.andWhere(
          '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.walletAddress ILIKE :search OR org.name ILIKE :search)',
          { search: `%${searchTerm}%` }
        );
      }

      if (organizationId) {
        query = query.andWhere('user.organizationId = :organizationId', { organizationId });
      }

      if (adminOnly) {
        // Filter for users with admin or super admin roles
        query = query.andWhere(
          'EXISTS (SELECT 1 FROM user_roles ur INNER JOIN roles r ON ur.roleId = r.id WHERE ur.userId = user.id AND ur.isActive = true AND r.key IN (:...adminRoles) AND (ur.organizationId IS NULL OR ur.organizationId = user.organizationId))'
        );
      }

      // Get total count before applying limit/offset
      const countQuery = query.clone();
      const total = await countQuery.getCount();

      const results = await query
        .orderBy('user.lastLoginAt', 'DESC')
        .addOrderBy('user.createdAt', 'DESC')
        .limit(limit)
        .offset(offset)
        .getRawMany();

      // Get detailed user roles separately for each user for better performance
      const userIds = results.map(row => row.user_id);
      let userRolesData: any[] = [];
      
      if (userIds.length > 0) {
        userRolesData = await this.userRoleRepository
          .createQueryBuilder('userRole')
          .leftJoinAndSelect('userRole.role', 'role')
          .leftJoinAndSelect('userRole.organization', 'roleOrg')
          .where('userRole.userId IN (:...userIds)', { userIds })
          .andWhere('userRole.isActive = true')
          .andWhere('(userRole.expiresAt IS NULL OR userRole.expiresAt > NOW())')
          .orderBy('role.priority', 'ASC')
          .getMany();
      }

      // Group roles by user ID with enhanced information
      const rolesByUserId = userRolesData.reduce((acc: any, userRole: any) => {
        if (!acc[userRole.userId]) {
          acc[userRole.userId] = [];
        }
        acc[userRole.userId].push({
          key: userRole.role.key,
          name: userRole.role.name,
          type: userRole.role.type,
          organizationId: userRole.organizationId,
          organizationName: userRole.organization?.name || null,
          isSystemRole: !userRole.organizationId,
          priority: userRole.role.priority || 999,
          assignedAt: userRole.createdAt,
          expiresAt: userRole.expiresAt
        });
        return acc;
      }, {});

      const users: UserWithStats[] = results.map(row => {
        const userRoles = rolesByUserId[row.user_id] || [];
        const displayName = `${row.user_firstname || ''} ${row.user_lastname || ''}`.trim() || row.user_email || 'Unknown User';
        
        return {
          id: row.user_id,
          email: row.user_email,
          walletAddress: row.user_walletaddress,
          firstName: row.user_firstname,
          lastName: row.user_lastname,
          displayName,
          roles: userRoles.sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999)),
          isActive: row.user_isactive,
          organizationName: row.organizationname || 'No Organization',
          organizationSlug: row.organizationslug,
          invoiceCount: parseInt(row.invoicecount) || 0,
          completedInvoiceCount: parseInt(row.completedinvoicecount) || 0,
          invoicesThisMonth: parseInt(row.invoicesthismonth) || 0,
          totalPayments: row.totalpayments?.toString() || '0',
          activityCount: parseInt(row.activitycount) || 0,
          systemRoleCount: parseInt(row.systemrolecount) || 0,
          orgRoleCount: parseInt(row.orgrolecount) || 0,
          lastLoginAt: row.user_lastloginat,
          createdAt: row.user_createdat,
          // Derived fields
          isSystemAdmin: userRoles.some((role: any) => ['admin', 'super_admin', 'system_admin'].includes(role.key) && role.isSystemRole),
          highestRole: userRoles.length > 0 ? userRoles[0].key : 'user'
        };
      });

      this.logger.info('Users with stats fetched successfully', {
        count: users.length,
        total,
        searchTerm,
        organizationId,
        adminOnly,
        avgRolesPerUser: userRolesData.length / Math.max(users.length, 1)
      });

      return { users, total };
    } catch (error: any) {
      this.logger.error('Failed to fetch users with stats', {
        error: error.message,
        stack: error.stack,
        searchTerm,
        organizationId,
        adminOnly
      });
      throw error;
    }
  }

  /**
   * Get enhanced activity logs for admin dashboard with comprehensive filtering
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
      searchTerm?: string;
      ipAddress?: string;
      recordId?: string;
    } = {}
  ): Promise<{ logs: ActivityLogEntry[]; total: number }> {
    this.logger.info('Fetching enhanced activity logs', { limit, offset, filters });

    try {
      let query = this.auditLogRepository
        .createQueryBuilder('audit')
        .leftJoin('audit.user', 'user')
        .leftJoin('audit.organization', 'org')
        .select([
          'audit.id',
          'audit.action',
          'audit.tableName',
          'audit.recordId',
          'audit.adminAction',
          'audit.severityLevel',
          'audit.ipAddress',
          'audit.userAgent',
          'audit.createdAt',
          'audit.metadata',
          'audit.oldValues',
          'audit.newValues',
          'user.id as userId',
          'user.email',
          'user.firstName',
          'user.lastName',
          'user.walletAddress',
          'org.id as organizationId',
          'org.name as organizationName',
          'org.slug as organizationSlug'
        ])
        ; // audit_logs table doesn't have soft delete functionality

      // Apply filters with enhanced logic
      if (filters.adminOnly) {
        query = query.andWhere('audit.adminAction = true');
      }

      if (filters.highRiskOnly) {
        query = query.andWhere(
          '(audit.adminAction = true OR audit.severityLevel IN (\'high\', \'critical\') OR audit.action IN (\'DELETE\', \'EXPORT\', \'IMPORT\') OR audit.tableName IN (\'users\', \'organizations\', \'system_settings\'))'
        );
      }

      if (filters.userId) {
        query = query.andWhere('audit.userId = :userId', { userId: filters.userId });
      }

      if (filters.organizationId) {
        query = query.andWhere('audit.organizationId = :organizationId', { organizationId: filters.organizationId });
      }

      if (filters.action) {
        if (Array.isArray(filters.action)) {
          query = query.andWhere('audit.action IN (:...actions)', { actions: filters.action });
        } else {
          query = query.andWhere('audit.action = :action', { action: filters.action });
        }
      }

      if (filters.tableName) {
        if (Array.isArray(filters.tableName)) {
          query = query.andWhere('audit.tableName IN (:...tableNames)', { tableNames: filters.tableName });
        } else {
          query = query.andWhere('audit.tableName = :tableName', { tableName: filters.tableName });
        }
      }

      if (filters.severityLevel) {
        if (Array.isArray(filters.severityLevel)) {
          query = query.andWhere('audit.severityLevel IN (:...severityLevels)', { severityLevels: filters.severityLevel });
        } else {
          query = query.andWhere('audit.severityLevel = :severityLevel', { severityLevel: filters.severityLevel });
        }
      }

      if (filters.startDate) {
        query = query.andWhere('audit.createdAt >= :startDate', { startDate: filters.startDate });
      }

      if (filters.endDate) {
        query = query.andWhere('audit.createdAt <= :endDate', { endDate: filters.endDate });
      }

      if (filters.ipAddress) {
        query = query.andWhere('audit.ipAddress = :ipAddress', { ipAddress: filters.ipAddress });
      }

      if (filters.recordId) {
        query = query.andWhere('audit.recordId = :recordId', { recordId: filters.recordId });
      }

      // Enhanced search functionality
      if (filters.searchTerm) {
        const searchPattern = `%${filters.searchTerm}%`;
        query = query.andWhere(
          '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR org.name ILIKE :search OR audit.tableName ILIKE :search OR audit.action ILIKE :search OR audit.recordId ILIKE :search)',
          { search: searchPattern }
        );
      }

      // Get total count for pagination
      const countQuery = query.clone();
      const total = await countQuery.getCount();

      // Execute main query with sorting and pagination
      const results = await query
        .orderBy('audit.createdAt', 'DESC')
        .addOrderBy('audit.id', 'DESC') // Secondary sort for consistency
        .limit(limit)
        .offset(offset)
        .getRawMany();

      const logs: ActivityLogEntry[] = results.map(row => {
        const userDisplayName = this.buildUserDisplayName(
          row.user_firstname,
          row.user_lastname,
          row.user_email,
          row.user_walletaddress
        );
        
        return {
          id: row.audit_id,
          action: row.audit_action,
          tableName: row.audit_tablename,
          recordId: row.audit_recordid,
          displayAction: this.formatDisplayAction(row.audit_action),
          displayTableName: this.formatDisplayTableName(row.audit_tablename),
          userDisplayName,
          userId: row.userid,
          organizationName: row.organizationname || 'System',
          organizationId: row.organizationid,
          organizationSlug: row.organizationslug,
          isHighRisk: this.isHighRiskAction(row),
          adminAction: row.audit_adminaction,
          severityLevel: row.audit_severitylevel,
          ipAddress: row.audit_ipaddress,
          userAgent: row.audit_useragent,
          createdAt: row.audit_createdat,
          metadata: row.audit_metadata,
          oldValues: row.audit_oldvalues,
          newValues: row.audit_newvalues,
          summary: this.generateEnhancedLogSummary(row, userDisplayName),
          // Additional derived fields
          timeAgo: this.formatTimeAgo(row.audit_createdat),
          riskScore: this.calculateRiskScore(row),
          category: this.categorizeAction(row.audit_action, row.audit_tablename)
        };
      });

      this.logger.info('Enhanced activity logs fetched successfully', {
        count: logs.length,
        total,
        filters,
        highRiskCount: logs.filter(log => log.isHighRisk).length,
        adminActionCount: logs.filter(log => log.adminAction).length
      });

      return { logs, total };
    } catch (error: any) {
      this.logger.error('Failed to fetch enhanced activity logs', {
        error: error.message,
        stack: error.stack,
        filters
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

  // Private helper methods with enhanced metrics
  private async getUserStats(
    startOfMonth: Date,
    startOfLastMonth: Date,
    endOfLastMonth: Date,
    startOfWeek: Date,
    startOfYear: Date
  ) {
    const [
      total,
      active,
      adminCount,
      superAdminCount,
      thisMonth,
      lastMonth,
      thisWeek,
      thisYear
    ] = await Promise.all([
      this.userRepository.count({ where: { deletedAt: null } }),
      this.userRepository.count({ where: { isActive: true, deletedAt: null } }),
      // Count users with admin system roles using RBAC
      this.userRoleRepository
        .createQueryBuilder('userRole')
        .leftJoin('userRole.role', 'role')
        .where('role.key = :adminKey', { adminKey: SystemRoleKey.ADMIN })
        .andWhere('userRole.isActive = true')
        .andWhere('userRole.organizationId IS NULL')
        .getCount(),
      // Count users with super admin system roles using RBAC
      this.userRoleRepository
        .createQueryBuilder('userRole')
        .leftJoin('userRole.role', 'role')
        .where('role.key = :superAdminKey', { superAdminKey: SystemRoleKey.SUPER_ADMIN })
        .andWhere('userRole.isActive = true')
        .andWhere('userRole.organizationId IS NULL')
        .getCount(),
      this.userRepository.createQueryBuilder('user')
        .where('user.createdAt >= :startOfMonth', { startOfMonth })
        .andWhere('user.deletedAt IS NULL')
        .getCount(),
      this.userRepository.createQueryBuilder('user')
        .where('user.createdAt >= :startOfLastMonth AND user.createdAt <= :endOfLastMonth', 
          { startOfLastMonth, endOfLastMonth })
        .andWhere('user.deletedAt IS NULL')
        .getCount(),
      this.userRepository.createQueryBuilder('user')
        .where('user.createdAt >= :startOfWeek', { startOfWeek })
        .andWhere('user.deletedAt IS NULL')
        .getCount(),
      this.userRepository.createQueryBuilder('user')
        .where('user.createdAt >= :startOfYear', { startOfYear })
        .andWhere('user.deletedAt IS NULL')
        .getCount()
    ]);

    const growthRate = this.calculateGrowthRate(thisMonth, lastMonth);
    const activeRate = total > 0 ? (active / total) * 100 : 0;

    return {
      total,
      active,
      adminUsers: adminCount,
      superAdminUsers: superAdminCount,
      thisMonth,
      lastMonth,
      thisWeek,
      thisYear,
      growthRate: Math.round(growthRate * 100) / 100,
      activeRate: Math.round(activeRate * 100) / 100
    };
  }

  private async getOrganizationStats(
    startOfMonth: Date,
    startOfLastMonth: Date,
    endOfLastMonth: Date,
    startOfWeek: Date
  ) {
    const [total, active, thisMonth, lastMonth, thisWeek, averageUsersQuery] = await Promise.all([
      this.organizationRepository.count({ where: { deletedAt: null } }),
      this.organizationRepository.count({ where: { deletedAt: null } }), // All are active for now
      this.organizationRepository.createQueryBuilder('org')
        .where('org.createdAt >= :startOfMonth', { startOfMonth })
        .andWhere('org.deletedAt IS NULL')
        .getCount(),
      this.organizationRepository.createQueryBuilder('org')
        .where('org.createdAt >= :startOfLastMonth AND org.createdAt <= :endOfLastMonth',
          { startOfLastMonth, endOfLastMonth })
        .andWhere('org.deletedAt IS NULL')
        .getCount(),
      this.organizationRepository.createQueryBuilder('org')
        .where('org.createdAt >= :startOfWeek', { startOfWeek })
        .andWhere('org.deletedAt IS NULL')
        .getCount(),
      this.organizationRepository.createQueryBuilder('org')
        .leftJoin('org.users', 'user', 'user.deletedAt IS NULL')
        .select('COUNT(user.id) / COUNT(DISTINCT org.id)::decimal as avgUsers')
        .where('org.deletedAt IS NULL')
        .getRawOne()
    ]);

    const growthRate = this.calculateGrowthRate(thisMonth, lastMonth);
    const averageUsersPerOrg = Math.round(parseFloat(averageUsersQuery?.avgusers || '0') * 100) / 100;

    return {
      total,
      active,
      thisMonth,
      lastMonth,
      thisWeek,
      growthRate: Math.round(growthRate * 100) / 100,
      averageUsersPerOrg
    };
  }

  private async getInvoiceStats(
    startOfMonth: Date,
    startOfLastMonth: Date,
    endOfLastMonth: Date,
    startOfWeek: Date,
    startOfYear: Date
  ) {
    const totalQuery = this.invoiceRepository.createQueryBuilder('invoice')
      .select([
        'COUNT(*) as total',
        'SUM(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount::decimal ELSE 0 END) as totalValue',
        'AVG(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount::decimal ELSE NULL END) as averageValue',
        'COUNT(CASE WHEN invoice.status = \'completed\' THEN 1 END) as completed'
      ])
      .where('invoice.deletedAt IS NULL')
      .getRawOne();

    const thisMonthQuery = this.invoiceRepository.createQueryBuilder('invoice')
      .select([
        'COUNT(*) as thisMonth',
        'SUM(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount::decimal ELSE 0 END) as thisMonthValue'
      ])
      .where('invoice.createdAt >= :startOfMonth', { startOfMonth })
      .andWhere('invoice.deletedAt IS NULL')
      .getRawOne();

    const lastMonthQuery = this.invoiceRepository.createQueryBuilder('invoice')
      .select([
        'COUNT(*) as lastMonth',
        'SUM(CASE WHEN invoice.amount IS NOT NULL THEN invoice.amount::decimal ELSE 0 END) as lastMonthValue'
      ])
      .where('invoice.createdAt >= :startOfLastMonth AND invoice.createdAt <= :endOfLastMonth',
        { startOfLastMonth, endOfLastMonth })
      .andWhere('invoice.deletedAt IS NULL')
      .getRawOne();

    const additionalStatsQuery = Promise.all([
      this.invoiceRepository.createQueryBuilder('invoice')
        .where('invoice.createdAt >= :startOfWeek', { startOfWeek })
        .andWhere('invoice.deletedAt IS NULL')
        .getCount(),
      this.invoiceRepository.createQueryBuilder('invoice')
        .where('invoice.createdAt >= :startOfYear', { startOfYear })
        .andWhere('invoice.deletedAt IS NULL')
        .getCount()
    ]);

    const [totalStats, monthStats, lastMonthStats, [thisWeek, thisYear]] = await Promise.all([
      totalQuery,
      thisMonthQuery,
      lastMonthQuery,
      additionalStatsQuery
    ]);

    const total = parseInt(totalStats.total) || 0;
    const completed = parseInt(totalStats.completed) || 0;
    const completedRate = total > 0 ? (completed / total) * 100 : 0;
    const growthRate = this.calculateGrowthRate(
      parseInt(monthStats.thismonth) || 0,
      parseInt(lastMonthStats.lastmonth) || 0
    );

    return {
      total,
      thisMonth: parseInt(monthStats.thismonth) || 0,
      lastMonth: parseInt(lastMonthStats.lastmonth) || 0,
      thisWeek,
      thisYear,
      totalValue: totalStats.totalvalue?.toString() || '0',
      thisMonthValue: monthStats.thismonthvalue?.toString() || '0',
      lastMonthValue: lastMonthStats.lastmonthvalue?.toString() || '0',
      averageValue: totalStats.averagevalue?.toString() || '0',
      completedRate: Math.round(completedRate * 100) / 100,
      growthRate: Math.round(growthRate * 100) / 100
    };
  }

  private async getPaymentStats(
    startOfMonth: Date,
    startOfLastMonth: Date,
    endOfLastMonth: Date,
    startOfWeek: Date,
    startOfYear: Date
  ) {
    const totalQuery = this.paymentRepository.createQueryBuilder('payment')
      .select([
        'COUNT(*) as total',
        'SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount::decimal ELSE 0 END) as totalValue',
        'COUNT(CASE WHEN payment.status = \'completed\' THEN 1 END) as successful',
        'AVG(CASE WHEN payment.amount IS NOT NULL THEN payment.amount::decimal ELSE NULL END) as averageAmount'
      ])
      // payments table doesn't have soft delete functionality
      .getRawOne();

    const thisMonthQuery = this.paymentRepository.createQueryBuilder('payment')
      .select([
        'COUNT(*) as thisMonth',
        'SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount::decimal ELSE 0 END) as thisMonthValue'
      ])
      .where('payment.createdAt >= :startOfMonth', { startOfMonth })
      // payments table doesn't have soft delete functionality
      .getRawOne();

    const lastMonthQuery = this.paymentRepository.createQueryBuilder('payment')
      .select([
        'COUNT(*) as lastMonth',
        'SUM(CASE WHEN payment.amount IS NOT NULL THEN payment.amount::decimal ELSE 0 END) as lastMonthValue'
      ])
      .where('payment.createdAt >= :startOfLastMonth AND payment.createdAt <= :endOfLastMonth',
        { startOfLastMonth, endOfLastMonth })
      // payments table doesn't have soft delete functionality
      .getRawOne();

    const additionalStatsQuery = Promise.all([
      this.paymentRepository.createQueryBuilder('payment')
        .where('payment.createdAt >= :startOfWeek', { startOfWeek })
        // payments table doesn't have soft delete functionality
        .getCount(),
      this.paymentRepository.createQueryBuilder('payment')
        .where('payment.createdAt >= :startOfYear', { startOfYear })
        // payments table doesn't have soft delete functionality
        .getCount()
    ]);

    const [totalStats, monthStats, lastMonthStats, [thisWeek, thisYear]] = await Promise.all([
      totalQuery,
      thisMonthQuery,
      lastMonthQuery,
      additionalStatsQuery
    ]);

    const total = parseInt(totalStats.total) || 0;
    const successful = parseInt(totalStats.successful) || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 0;
    const growthRate = this.calculateGrowthRate(
      parseInt(monthStats.thismonth) || 0,
      parseInt(lastMonthStats.lastmonth) || 0
    );

    return {
      total,
      thisMonth: parseInt(monthStats.thismonth) || 0,
      lastMonth: parseInt(lastMonthStats.lastmonth) || 0,
      thisWeek,
      thisYear,
      totalValue: totalStats.totalvalue?.toString() || '0',
      thisMonthValue: monthStats.thismonthvalue?.toString() || '0',
      lastMonthValue: lastMonthStats.lastmonthvalue?.toString() || '0',
      successRate: Math.round(successRate * 100) / 100,
      averageAmount: totalStats.averageamount?.toString() || '0',
      growthRate: Math.round(growthRate * 100) / 100
    };
  }

  private async getTemplateStats(startOfMonth: Date) {
    const [system, organizational, active, thisMonth, popularTemplatesData] = await Promise.all([
      this.templateRepository.createQueryBuilder('template')
        .where('template.organizationId IS NULL')
        .andWhere('template.deletedAt IS NULL')
        .getCount(),
      this.templateRepository.createQueryBuilder('template')
        .where('template.organizationId IS NOT NULL')
        .andWhere('template.deletedAt IS NULL')
        .getCount(),
      this.templateRepository.count({ where: { isActive: true, deletedAt: null } }),
      this.templateRepository.createQueryBuilder('template')
        .where('template.createdAt >= :startOfMonth', { startOfMonth })
        .andWhere('template.deletedAt IS NULL')
        .getCount(),
      // Get popular templates (placeholder - would need usage tracking)
      this.templateRepository.createQueryBuilder('template')
        .select(['template.id', 'template.name', 'template.description'])
        .addSelect('0 as usageCount') // Placeholder
        .where('template.isActive = true')
        .andWhere('template.deletedAt IS NULL')
        .orderBy('template.createdAt', 'DESC')
        .limit(5)
        .getRawMany()
    ]);

    const popularTemplates = popularTemplatesData.map(template => ({
      id: template.template_id,
      name: template.template_name,
      usageCount: parseInt(template.usagecount) || 0
    }));

    const totalUsage = system + organizational; // Basic count for now

    return {
      system,
      organizational,
      active,
      thisMonth,
      totalUsage,
      popularTemplates
    };
  }

  private async getSystemHealth() {
    // Comprehensive system health check
    const issues: string[] = [];
    const startTime = Date.now();
    let performanceScore = 100;
    
    try {
      // Database connectivity and performance check
      const dbStartTime = Date.now();
      await this.userRepository.count();
      const dbResponseTime = Date.now() - dbStartTime;
      
      if (dbResponseTime > 2000) {
        issues.push('Database response time is slow (>2s)');
        performanceScore -= 20;
      } else if (dbResponseTime > 1000) {
        issues.push('Database response time is elevated (>1s)');
        performanceScore -= 10;
      }
    } catch (error) {
      issues.push('Database connectivity issue');
      performanceScore -= 50;
    }

    try {
      // Check for recent errors in audit logs
      const recentErrors = await this.auditLogRepository.createQueryBuilder('audit')
        .where('audit.severityLevel IN (:...levels)', { levels: ['high', 'critical'] })
        .andWhere('audit.createdAt >= :oneHourAgo', { oneHourAgo: new Date(Date.now() - 60 * 60 * 1000) })
        .getCount();
      
      if (recentErrors > 10) {
        issues.push(`High number of critical errors in last hour: ${recentErrors}`);
        performanceScore -= 15;
      }
    } catch (error) {
      // Ignore audit log check errors
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.rss / 1024 / 1024;
    if (memUsageMB > 512) {
      issues.push(`High memory usage: ${Math.round(memUsageMB)}MB`);
      performanceScore -= 10;
    }

    // CPU usage simulation (simplified)
    const loadAvg = require('os').loadavg();
    if (loadAvg[0] > 0.8) {
      issues.push('High CPU load detected');
      performanceScore -= 15;
    }

    const status = performanceScore >= 90 ? 'healthy' : performanceScore >= 70 ? 'degraded' : 'critical';

    return {
      status: status as 'healthy' | 'degraded' | 'critical',
      uptime: process.uptime(),
      lastUpdated: new Date().toISOString(),
      issues,
      performanceScore: Math.max(0, performanceScore)
    };
  }

  // Enhanced helper methods for comprehensive statistics
  private async getGrowthStats(
    startOfMonth: Date,
    startOfLastMonth: Date,
    endOfLastMonth: Date,
    startOfWeek: Date
  ) {
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      return {
        start: new Date(date.getFullYear(), date.getMonth(), 1),
        end: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
        period: date.toISOString().slice(0, 7) // YYYY-MM format
      };
    }).reverse();

    const [userGrowthData, revenueGrowthData, organizationGrowthData] = await Promise.all([
      // User growth trend
      Promise.all(
        last6Months.map(async (month) => {
          const count = await this.userRepository.createQueryBuilder('user')
            .where('user.createdAt >= :start AND user.createdAt <= :end', 
              { start: month.start, end: month.end })
            .andWhere('user.deletedAt IS NULL')
            .getCount();
          return { period: month.period, count };
        })
      ),
      // Revenue growth trend
      Promise.all(
        last6Months.map(async (month) => {
          const result = await this.paymentRepository.createQueryBuilder('payment')
            .select('COALESCE(SUM(payment.amount::decimal), 0) as amount')
            .where('payment.createdAt >= :start AND payment.createdAt <= :end',
              { start: month.start, end: month.end })
            .andWhere('payment.status = :status', { status: 'completed' })
            // payments table doesn't have soft delete functionality
            .getRawOne();
          return { period: month.period, amount: result.amount?.toString() || '0' };
        })
      ),
      // Organization growth trend
      Promise.all(
        last6Months.map(async (month) => {
          const count = await this.organizationRepository.createQueryBuilder('org')
            .where('org.createdAt >= :start AND org.createdAt <= :end',
              { start: month.start, end: month.end })
            .andWhere('org.deletedAt IS NULL')
            .getCount();
          return { period: month.period, count };
        })
      )
    ]);

    return {
      userGrowthTrend: userGrowthData,
      revenueGrowthTrend: revenueGrowthData,
      organizationGrowthTrend: organizationGrowthData
    };
  }

  private async getPerformanceStats(startOfWeek: Date) {
    // Simulate performance metrics (in a real system, these would come from monitoring tools)
    const simulatedMetrics = {
      averageResponseTime: 120 + Math.random() * 50, // ms
      errorRate: Math.random() * 0.5, // %
      throughput: 100 + Math.random() * 50, // requests per minute
      activeConnections: 10 + Math.floor(Math.random() * 20)
    };

    try {
      // Get actual error count from audit logs as a proxy for error rate
      const errorCount = await this.auditLogRepository.createQueryBuilder('audit')
        .where('audit.createdAt >= :startOfWeek', { startOfWeek })
        .andWhere('audit.severityLevel IN (:...levels)', { levels: ['high', 'critical'] })
        .getCount();

      const totalLogs = await this.auditLogRepository.createQueryBuilder('audit')
        .where('audit.createdAt >= :startOfWeek', { startOfWeek })
        .getCount();

      const actualErrorRate = totalLogs > 0 ? (errorCount / totalLogs) * 100 : 0;
      
      return {
        averageResponseTime: Math.round(simulatedMetrics.averageResponseTime),
        errorRate: Math.round(actualErrorRate * 100) / 100,
        throughput: Math.round(simulatedMetrics.throughput),
        activeConnections: simulatedMetrics.activeConnections
      };
    } catch (error) {
      // Fallback to simulated metrics if audit log query fails
      return {
        averageResponseTime: Math.round(simulatedMetrics.averageResponseTime),
        errorRate: Math.round(simulatedMetrics.errorRate * 100) / 100,
        throughput: Math.round(simulatedMetrics.throughput),
        activeConnections: simulatedMetrics.activeConnections
      };
    }
  }

  // Calculation helper methods
  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private calculateConversionRate(invoices: number, payments: number): number {
    if (invoices === 0) return 0;
    return (payments / invoices) * 100;
  }

  private calculateActiveUsersRate(activeUsers: number, totalUsers: number): number {
    if (totalUsers === 0) return 0;
    return (activeUsers / totalUsers) * 100;
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

  // Enhanced helper methods for activity logs
  private buildUserDisplayName(
    firstName?: string,
    lastName?: string,
    email?: string,
    walletAddress?: string
  ): string {
    const fullName = `${firstName || ''} ${lastName || ''}`.trim();
    if (fullName) return fullName;
    if (email) return email;
    if (walletAddress) return `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}`;
    return 'System';
  }

  private generateEnhancedLogSummary(row: any, userDisplayName: string): string {
    const action = this.formatDisplayAction(row.audit_action).toLowerCase();
    const table = this.formatDisplayTableName(row.audit_tablename).toLowerCase();
    const recordId = row.audit_recordid ? ` (ID: ${row.audit_recordid})` : '';
    
    switch (row.audit_action) {
      case 'CREATE':
        return `${userDisplayName} created a new ${table}${recordId}`;
      case 'UPDATE':
        return `${userDisplayName} updated ${table}${recordId}`;
      case 'DELETE':
        return `${userDisplayName} deleted ${table}${recordId}`;
      case 'LOGIN':
        return `${userDisplayName} logged in from ${row.audit_ipaddress || 'unknown IP'}`;
      case 'LOGOUT':
        return `${userDisplayName} logged out`;
      case 'EXPORT':
        return `${userDisplayName} exported ${table} data`;
      case 'IMPORT':
        return `${userDisplayName} imported ${table} data`;
      case 'VIEW':
        return `${userDisplayName} viewed ${table}${recordId}`;
      case 'DOWNLOAD':
        return `${userDisplayName} downloaded ${table} data`;
      default:
        return `${userDisplayName} performed ${action} on ${table}${recordId}`;
    }
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  private calculateRiskScore(row: any): number {
    let score = 0;

    // Action-based risk
    const highRiskActions = ['DELETE', 'EXPORT', 'IMPORT'];
    const mediumRiskActions = ['UPDATE', 'CREATE'];
    
    if (highRiskActions.includes(row.audit_action)) score += 40;
    else if (mediumRiskActions.includes(row.audit_action)) score += 20;
    else score += 10;

    // Table-based risk
    const highRiskTables = ['users', 'organizations', 'system_settings', 'audit_logs'];
    const mediumRiskTables = ['invoices', 'payments', 'templates'];
    
    if (highRiskTables.includes(row.audit_tablename)) score += 30;
    else if (mediumRiskTables.includes(row.audit_tablename)) score += 15;
    else score += 5;

    // Admin action risk
    if (row.audit_adminaction) score += 20;

    // Severity level risk
    switch (row.audit_severitylevel) {
      case 'critical': score += 25; break;
      case 'high': score += 15; break;
      case 'medium': score += 10; break;
      default: score += 5;
    }

    return Math.min(100, score); // Cap at 100
  }

  private categorizeAction(action: string, tableName: string): string {
    // Categorize actions for better organization
    const authActions = ['LOGIN', 'LOGOUT', 'REGISTER'];
    const dataActions = ['CREATE', 'UPDATE', 'DELETE'];
    const accessActions = ['VIEW', 'EXPORT', 'DOWNLOAD'];
    const adminActions = ['IMPORT', 'BULK_UPDATE', 'SYSTEM_CONFIG'];

    if (authActions.includes(action)) return 'Authentication';
    if (dataActions.includes(action)) return 'Data Management';
    if (accessActions.includes(action)) return 'Data Access';
    if (adminActions.includes(action)) return 'Administration';

    // Table-based categorization
    const userTables = ['users', 'user_roles', 'user_sessions'];
    const financialTables = ['invoices', 'payments', 'transactions'];
    const systemTables = ['organizations', 'system_settings', 'templates'];

    if (userTables.some(table => tableName?.includes(table))) return 'User Management';
    if (financialTables.some(table => tableName?.includes(table))) return 'Financial';
    if (systemTables.some(table => tableName?.includes(table))) return 'System Configuration';

    return 'General';
  }

  private generateLogSummary(row: any, userDisplayName: string): string {
    // Fallback method for backwards compatibility
    return this.generateEnhancedLogSummary(row, userDisplayName);
  }
}