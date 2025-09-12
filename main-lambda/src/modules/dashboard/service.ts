import { Repository } from 'typeorm';
import { AppDataSource } from '@/database/data-source';
import { User } from '@/database/entities/User';
import { Organization } from '@/database/entities/Organization';
import { Invoice } from '@/database/entities/Invoice';
import { Payment } from '@/database/entities/Payment';
import { AuditLog } from '@/database/entities/AuditLog';
import { UserRepository } from '@/database/repositories/UserRepository';
import { InvoiceRepository } from '@/database/repositories/InvoiceRepository';
import { PaymentRepository } from '@/database/repositories/PaymentRepository';
import { OrganizationRepository } from '@/database/repositories/OrganizationRepository';
import { AuditLogRepository } from '@/database/repositories/AuditLogRepository';
import { RBACService } from '@/shared/services/rbac.service';
import { Logger } from '@/shared/utils/logger';
import { TenantContext } from '@/types/common';
import { 
  createNotFoundError, 
  createValidationError, 
  createForbiddenError 
} from '@/shared/errors';
import {
  UserInfo,
  SystemStats,
  OrganizationStats,
  PersonalStats,
  ActivityItem,
  SystemHealth,
  QuickAction,
  AdminDashboardResponse,
  FrontendDashboardResponse,
  ClientType,
  DashboardFilters
} from './types';

export class DashboardService {
  private userRepository: UserRepository;
  private invoiceRepository: InvoiceRepository;
  private paymentRepository: PaymentRepository;
  private organizationRepository: OrganizationRepository;
  private auditLogRepository: AuditLogRepository;
  private rbacService: RBACService;
  private logger: Logger;

  constructor() {
    this.userRepository = new UserRepository();
    this.invoiceRepository = new InvoiceRepository();
    this.paymentRepository = new PaymentRepository();
    this.organizationRepository = new OrganizationRepository();
    this.auditLogRepository = new AuditLogRepository();
    this.rbacService = new RBACService();
    this.logger = new Logger('DashboardService');
  }

  /**
   * Get dashboard data based on client type and user role
   */
  async getDashboardData(
    tenantContext: TenantContext,
    clientType: ClientType,
    filters?: DashboardFilters
  ): Promise<AdminDashboardResponse | FrontendDashboardResponse> {
    this.logger.info('Getting dashboard data', {
      userId: tenantContext.userId,
      clientType,
      organizationId: tenantContext.tenantId
    });

    const user = await this.userRepository.findById(tenantContext.userId!);
    if (!user) {
      throw createNotFoundError('User not found');
    }

    // Get user permissions
    const userPermissions = await this.rbacService.getUserPermissions(
      tenantContext.userId!,
      tenantContext.tenantId
    );

    if (!userPermissions) {
      throw createForbiddenError('User has no valid permissions');
    }

    // Build user info
    const userInfo: UserInfo = {
      id: user.id,
      email: user.email,
      role: await this.rbacService.getUserHighestRole(tenantContext.userId!, tenantContext.tenantId) || 'member',
      permissions: userPermissions.permissions,
      organizationId: tenantContext.tenantId,
      organizationName: user.organization?.name
    };

    if (clientType === ClientType.ADMIN_FRONTEND && userPermissions.isSystemAdmin) {
      return this.getAdminDashboard(userInfo, tenantContext, filters);
    } else {
      return this.getFrontendDashboard(userInfo, tenantContext, filters);
    }
  }

  /**
   * Get admin dashboard data for system administrators
   */
  private async getAdminDashboard(
    userInfo: UserInfo,
    tenantContext: TenantContext,
    filters?: DashboardFilters
  ): Promise<AdminDashboardResponse> {
    this.logger.info('Building admin dashboard', {
      userId: tenantContext.userId
    });

    const [systemStats, recentActivity, systemHealth] = await Promise.all([
      this.getSystemStats(filters),
      this.getRecentActivity(tenantContext, { limit: 20, adminOnly: true }),
      this.getSystemHealth()
    ]);

    return {
      user_info: userInfo,
      system_stats: systemStats,
      recent_activity: recentActivity,
      system_health: systemHealth
    };
  }

  /**
   * Get frontend dashboard data for normal users
   */
  private async getFrontendDashboard(
    userInfo: UserInfo,
    tenantContext: TenantContext,
    filters?: DashboardFilters
  ): Promise<FrontendDashboardResponse> {
    this.logger.info('Building frontend dashboard', {
      userId: tenantContext.userId,
      organizationId: tenantContext.tenantId
    });

    const [organizationStats, personalStats, quickActions] = await Promise.all([
      this.getOrganizationStats(tenantContext.tenantId!, filters),
      this.getPersonalStats(tenantContext.userId!, tenantContext.tenantId!, filters),
      this.getQuickActions(userInfo.permissions)
    ]);

    return {
      user_info: userInfo,
      organization_stats: organizationStats,
      personal_stats: personalStats,
      quick_actions: quickActions
    };
  }

  /**
   * Get system-wide statistics for admin dashboard
   */
  private async getSystemStats(filters?: DashboardFilters): Promise<SystemStats> {
    const dateFilter = filters?.dateRange;
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    // Get aggregated counts from database
    const userRepo = AppDataSource.getRepository(User);
    const orgRepo = AppDataSource.getRepository(Organization);
    const invoiceRepo = AppDataSource.getRepository(Invoice);
    const paymentRepo = AppDataSource.getRepository(Payment);

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      newUsersThisMonth,
      totalOrganizations,
      activeOrganizations,
      newOrganizationsThisMonth,
      totalInvoices,
      totalInvoiceValue,
      invoicesThisMonth,
      paidInvoices,
      totalPayments,
      totalPaymentValue,
      successfulPayments,
      paymentsThisMonth
    ] = await Promise.all([
      // User stats
      userRepo.count(),
      userRepo.count({ where: { isActive: true } }),
      userRepo.createQueryBuilder('user')
        .innerJoin('user.userRoles', 'userRole')
        .innerJoin('userRole.role', 'role')
        .where('role.isSystemAdmin = :isSystemAdmin', { isSystemAdmin: true })
        .andWhere('userRole.isActive = :isActive', { isActive: true })
        .getCount(),
      userRepo.createQueryBuilder('user')
        .where('user.createdAt >= :thisMonth', { thisMonth })
        .getCount(),

      // Organization stats
      orgRepo.count(),
      orgRepo.count({ where: { isActive: true } }),
      orgRepo.createQueryBuilder('org')
        .where('org.createdAt >= :thisMonth', { thisMonth })
        .getCount(),

      // Invoice stats
      invoiceRepo.count(),
      invoiceRepo.createQueryBuilder('invoice')
        .select('SUM(invoice.amount)', 'total')
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),
      invoiceRepo.createQueryBuilder('invoice')
        .where('invoice.createdAt >= :thisMonth', { thisMonth })
        .getCount(),
      invoiceRepo.count({ where: { status: 'paid' } }),

      // Payment stats
      paymentRepo.count(),
      paymentRepo.createQueryBuilder('payment')
        .select('SUM(payment.amount)', 'total')
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),
      paymentRepo.count({ where: { status: 'confirmed' } }),
      paymentRepo.createQueryBuilder('payment')
        .where('payment.createdAt >= :thisMonth', { thisMonth })
        .getCount()
    ]);

    const successRate = totalInvoices > 0 ? (paidInvoices / totalInvoices) * 100 : 0;
    const paymentSuccessRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0;

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        admin_users: adminUsers,
        new_this_month: newUsersThisMonth
      },
      organizations: {
        total: totalOrganizations,
        active: activeOrganizations,
        new_this_month: newOrganizationsThisMonth
      },
      invoices: {
        total: totalInvoices,
        total_value: totalInvoiceValue,
        this_month: invoicesThisMonth,
        success_rate: Math.round(successRate * 100) / 100
      },
      payments: {
        total: totalPayments,
        total_value: totalPaymentValue,
        success_rate: Math.round(paymentSuccessRate * 100) / 100,
        this_month: paymentsThisMonth
      },
      platform_health: {
        uptime: process.uptime(),
        response_time: 0, // Would be calculated from monitoring data
        error_rate: 0 // Would be calculated from error tracking
      }
    };
  }

  /**
   * Get organization-specific statistics
   */
  private async getOrganizationStats(
    organizationId: string,
    filters?: DashboardFilters
  ): Promise<OrganizationStats> {
    const invoiceRepo = AppDataSource.getRepository(Invoice);
    const paymentRepo = AppDataSource.getRepository(Payment);
    const userRepo = AppDataSource.getRepository(User);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [
      totalInvoices,
      pendingInvoices,
      paidInvoices,
      totalInvoiceValue,
      totalPaymentsReceived,
      pendingInvoiceAmount,
      paymentsThisMonth,
      totalMembers,
      activeMembers
    ] = await Promise.all([
      // Invoice stats
      invoiceRepo.count({ where: { organizationId } }),
      invoiceRepo.count({ where: { organizationId, status: 'pending' } }),
      invoiceRepo.count({ where: { organizationId, status: 'paid' } }),
      invoiceRepo.createQueryBuilder('invoice')
        .select('SUM(invoice.amount)', 'total')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),

      // Payment stats
      paymentRepo.createQueryBuilder('payment')
        .innerJoin('payment.invoice', 'invoice')
        .select('SUM(payment.amount)', 'total')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .andWhere('payment.status = :status', { status: 'confirmed' })
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),
      
      invoiceRepo.createQueryBuilder('invoice')
        .select('SUM(invoice.amount)', 'total')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .andWhere('invoice.status IN (:...statuses)', { statuses: ['pending', 'sent'] })
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),

      paymentRepo.createQueryBuilder('payment')
        .innerJoin('payment.invoice', 'invoice')
        .select('SUM(payment.amount)', 'total')
        .where('invoice.organizationId = :organizationId', { organizationId })
        .andWhere('payment.status = :status', { status: 'confirmed' })
        .andWhere('payment.createdAt >= :thisMonth', { thisMonth })
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),

      // Team stats
      userRepo.count({ where: { organizationId } }),
      userRepo.count({ where: { organizationId, isActive: true } })
    ]);

    return {
      invoices: {
        total: totalInvoices,
        pending: pendingInvoices,
        paid: paidInvoices,
        total_value: totalInvoiceValue
      },
      payments: {
        total_received: totalPaymentsReceived,
        pending_amount: pendingInvoiceAmount,
        this_month: paymentsThisMonth
      },
      team: {
        members: totalMembers,
        active_users: activeMembers
      }
    };
  }

  /**
   * Get personal statistics for a user
   */
  private async getPersonalStats(
    userId: string,
    organizationId: string,
    filters?: DashboardFilters
  ): Promise<PersonalStats> {
    const invoiceRepo = AppDataSource.getRepository(Invoice);

    const [
      totalInvoices,
      paidInvoices,
      pendingInvoices,
      totalInvoiceValue,
      recentActivity
    ] = await Promise.all([
      // User's invoice stats
      invoiceRepo.count({ where: { createdBy: userId, organizationId } }),
      invoiceRepo.count({ where: { createdBy: userId, organizationId, status: 'paid' } }),
      invoiceRepo.count({ where: { createdBy: userId, organizationId, status: 'pending' } }),
      invoiceRepo.createQueryBuilder('invoice')
        .select('SUM(invoice.amount)', 'total')
        .where('invoice.createdBy = :userId', { userId })
        .andWhere('invoice.organizationId = :organizationId', { organizationId })
        .getRawOne()
        .then(result => parseFloat(result.total || '0')),

      // Recent activity for the user
      this.getRecentActivity({ userId, tenantId: organizationId }, { limit: 10 })
    ]);

    return {
      my_invoices: {
        total: totalInvoices,
        paid: paidInvoices,
        pending: pendingInvoices,
        total_value: totalInvoiceValue
      },
      recent_activity: recentActivity
    };
  }

  /**
   * Get recent activity from audit logs
   */
  private async getRecentActivity(
    tenantContext: TenantContext,
    options: { limit?: number; adminOnly?: boolean } = {}
  ): Promise<ActivityItem[]> {
    const { limit = 10, adminOnly = false } = options;
    
    const auditRepo = AppDataSource.getRepository(AuditLog);
    const queryBuilder = auditRepo.createQueryBuilder('audit')
      .leftJoinAndSelect('audit.user', 'user')
      .orderBy('audit.createdAt', 'DESC')
      .limit(limit);

    if (!adminOnly && tenantContext.tenantId) {
      queryBuilder.where('audit.organizationId = :organizationId', {
        organizationId: tenantContext.tenantId
      });
    }

    if (options.adminOnly) {
      queryBuilder.where('audit.adminAction = :adminAction', { adminAction: true });
    }

    if (tenantContext.userId && !adminOnly) {
      queryBuilder.andWhere('audit.userId = :userId', { userId: tenantContext.userId });
    }

    const auditLogs = await queryBuilder.getMany();

    return auditLogs.map(log => ({
      id: log.id,
      type: this.mapAuditActionToActivityType(log.action),
      title: this.generateActivityTitle(log),
      description: this.generateActivityDescription(log),
      timestamp: log.createdAt,
      metadata: log.metadata,
      severity: this.mapSeverityLevel(log.severityLevel)
    }));
  }

  /**
   * Get system health status
   */
  private async getSystemHealth(): Promise<SystemHealth> {
    const checks = {
      database: { status: 'ok' as const, response_time: 0 },
      blockchain: { status: 'ok' as const, response_time: 0 },
      notifications: { status: 'ok' as const, response_time: 0 },
      cache: { status: 'ok' as const, response_time: 0 }
    };

    try {
      // Database check
      const dbStart = Date.now();
      await AppDataSource.query('SELECT 1');
      checks.database.response_time = Date.now() - dbStart;
    } catch (error) {
      checks.database = { status: 'error', response_time: 0 };
    }

    // Additional health checks would go here for other services

    const hasErrors = Object.values(checks).some(check => check.status === 'error');
    const status = hasErrors ? 'degraded' : 'healthy';

    return {
      status,
      services: checks
    };
  }

  /**
   * Get quick actions based on user permissions
   */
  private getQuickActions(permissions: string[]): QuickAction[] {
    const allActions: QuickAction[] = [
      {
        id: 'create_invoice',
        title: 'Create Invoice',
        description: 'Create a new invoice for your clients',
        icon: 'plus-circle',
        route: '/dashboard/invoices/create',
        permissions: ['invoice:create']
      },
      {
        id: 'view_invoices',
        title: 'View Invoices',
        description: 'Manage your existing invoices',
        icon: 'file-text',
        route: '/dashboard/invoices',
        permissions: ['invoice:read']
      },
      {
        id: 'analytics',
        title: 'Analytics',
        description: 'View detailed analytics and reports',
        icon: 'bar-chart',
        route: '/dashboard/analytics',
        permissions: ['analytics:read']
      },
      {
        id: 'team_management',
        title: 'Team Management',
        description: 'Manage team members and permissions',
        icon: 'users',
        route: '/dashboard/team',
        permissions: ['user:manage', 'org:admin']
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Configure your account and organization',
        icon: 'settings',
        route: '/dashboard/settings',
        permissions: ['settings:manage']
      }
    ];

    // Filter actions based on user permissions
    return allActions.filter(action => {
      if (!action.permissions || action.permissions.length === 0) {
        return true;
      }
      return action.permissions.some(permission => 
        permissions.includes(permission) || 
        permissions.some(userPerm => userPerm.endsWith(':*'))
      );
    });
  }

  /**
   * Map audit action to activity type
   */
  private mapAuditActionToActivityType(action: string): ActivityItem['type'] {
    switch (action.toLowerCase()) {
      case 'create':
        return 'invoice_created';
      case 'pay':
      case 'payment':
        return 'payment_received';
      case 'join':
      case 'register':
        return 'user_joined';
      case 'role_change':
      case 'assign_role':
        return 'role_changed';
      default:
        return 'system_alert';
    }
  }

  /**
   * Generate activity title from audit log
   */
  private generateActivityTitle(log: AuditLog): string {
    switch (log.action.toLowerCase()) {
      case 'create':
        return `${log.tableName || 'Item'} Created`;
      case 'update':
        return `${log.tableName || 'Item'} Updated`;
      case 'delete':
        return `${log.tableName || 'Item'} Deleted`;
      default:
        return log.action.charAt(0).toUpperCase() + log.action.slice(1);
    }
  }

  /**
   * Generate activity description from audit log
   */
  private generateActivityDescription(log: AuditLog): string {
    const userName = log.user?.displayName || 'Unknown user';
    
    switch (log.action.toLowerCase()) {
      case 'create':
        return `${userName} created a new ${log.tableName?.toLowerCase() || 'item'}`;
      case 'update':
        return `${userName} updated ${log.tableName?.toLowerCase() || 'an item'}`;
      case 'delete':
        return `${userName} deleted ${log.tableName?.toLowerCase() || 'an item'}`;
      default:
        return `${userName} performed ${log.action}`;
    }
  }

  /**
   * Map severity level to activity severity
   */
  private mapSeverityLevel(severity?: string): ActivityItem['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
      default:
        return 'low';
    }
  }
}