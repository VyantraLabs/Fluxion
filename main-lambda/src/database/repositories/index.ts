import { UserRepository } from './UserRepository';
import { InvoiceRepository } from './InvoiceRepository';
import { PaymentRepository } from './PaymentRepository';
import { PayrollBatchRepository } from './PayrollBatchRepository';
import { OrganizationRepository } from './OrganizationRepository';
import { BlockchainNetworkRepository } from './BlockchainNetworkRepository';
import { TokenRepository } from './TokenRepository';
import { SmartContractRepository } from './SmartContractRepository';
import { OrganizationSettingRepository } from './OrganizationSettingRepository';
import { AuditLogRepository } from './AuditLogRepository';
import { TemplateRepository } from './TemplateRepository';
import { TemplateCategoryRepository } from './TemplateCategoryRepository';
import { InvoiceAccessTokenRepository } from './InvoiceAccessTokenRepository';
import { NotificationQueueRepository } from './NotificationQueueRepository';
import { NotificationSettingsRepository } from './NotificationSettingsRepository';
import { PaymentVerificationJobRepository } from './PaymentVerificationJobRepository';
import { ReminderJobRepository } from './ReminderJobRepository';
import { Logger } from '@/shared/utils/logger';

/**
 * Repository Manager - Central access point for all repositories
 * Provides singleton instances and health checking
 */
class RepositoryManager {
  private static instance: RepositoryManager;
  private logger: Logger;
  
  // Repository instances
  private _userRepository?: UserRepository;
  private _invoiceRepository?: InvoiceRepository;
  private _paymentRepository?: PaymentRepository;
  private _payrollBatchRepository?: PayrollBatchRepository;
  private _organizationRepository?: OrganizationRepository;
  private _blockchainNetworkRepository?: BlockchainNetworkRepository;
  private _tokenRepository?: TokenRepository;
  private _smartContractRepository?: SmartContractRepository;
  private _organizationSettingRepository?: OrganizationSettingRepository;
  private _auditLogRepository?: AuditLogRepository;
  private _templateRepository?: TemplateRepository;
  private _templateCategoryRepository?: TemplateCategoryRepository;
  private _invoiceAccessTokenRepository?: InvoiceAccessTokenRepository;
  private _notificationQueueRepository?: NotificationQueueRepository;
  private _notificationSettingsRepository?: NotificationSettingsRepository;
  private _paymentVerificationJobRepository?: PaymentVerificationJobRepository;
  private _reminderJobRepository?: ReminderJobRepository;

  private constructor() {
    this.logger = new Logger('RepositoryManager');
  }

  static getInstance(): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager();
    }
    return RepositoryManager.instance;
  }

  // Lazy-loaded repository getters
  get users(): UserRepository {
    if (!this._userRepository) {
      this._userRepository = new UserRepository();
    }
    return this._userRepository;
  }

  get invoices(): InvoiceRepository {
    if (!this._invoiceRepository) {
      this._invoiceRepository = new InvoiceRepository();
    }
    return this._invoiceRepository;
  }

  get payments(): PaymentRepository {
    if (!this._paymentRepository) {
      this._paymentRepository = new PaymentRepository();
    }
    return this._paymentRepository;
  }

  get payrollBatches(): PayrollBatchRepository {
    if (!this._payrollBatchRepository) {
      this._payrollBatchRepository = new PayrollBatchRepository();
    }
    return this._payrollBatchRepository;
  }

  get organizations(): OrganizationRepository {
    if (!this._organizationRepository) {
      this._organizationRepository = new OrganizationRepository();
    }
    return this._organizationRepository;
  }

  get blockchainNetworks(): BlockchainNetworkRepository {
    if (!this._blockchainNetworkRepository) {
      this._blockchainNetworkRepository = new BlockchainNetworkRepository();
    }
    return this._blockchainNetworkRepository;
  }

  get tokens(): TokenRepository {
    if (!this._tokenRepository) {
      this._tokenRepository = new TokenRepository();
    }
    return this._tokenRepository;
  }

  get smartContracts(): SmartContractRepository {
    if (!this._smartContractRepository) {
      this._smartContractRepository = new SmartContractRepository();
    }
    return this._smartContractRepository;
  }

  get organizationSettings(): OrganizationSettingRepository {
    if (!this._organizationSettingRepository) {
      this._organizationSettingRepository = new OrganizationSettingRepository();
    }
    return this._organizationSettingRepository;
  }

  get auditLogs(): AuditLogRepository {
    if (!this._auditLogRepository) {
      this._auditLogRepository = new AuditLogRepository();
    }
    return this._auditLogRepository;
  }

  get templates(): TemplateRepository {
    if (!this._templateRepository) {
      this._templateRepository = new TemplateRepository();
    }
    return this._templateRepository;
  }

  get templateCategories(): TemplateCategoryRepository {
    if (!this._templateCategoryRepository) {
      this._templateCategoryRepository = new TemplateCategoryRepository();
    }
    return this._templateCategoryRepository;
  }

  get invoiceAccessTokens(): InvoiceAccessTokenRepository {
    if (!this._invoiceAccessTokenRepository) {
      this._invoiceAccessTokenRepository = new InvoiceAccessTokenRepository();
    }
    return this._invoiceAccessTokenRepository;
  }

  get notificationQueue(): NotificationQueueRepository {
    if (!this._notificationQueueRepository) {
      this._notificationQueueRepository = new NotificationQueueRepository();
    }
    return this._notificationQueueRepository;
  }

  get notificationSettings(): NotificationSettingsRepository {
    if (!this._notificationSettingsRepository) {
      this._notificationSettingsRepository = new NotificationSettingsRepository();
    }
    return this._notificationSettingsRepository;
  }

  get paymentVerificationJobs(): PaymentVerificationJobRepository {
    if (!this._paymentVerificationJobRepository) {
      this._paymentVerificationJobRepository = new PaymentVerificationJobRepository();
    }
    return this._paymentVerificationJobRepository;
  }

  get reminderJobs(): ReminderJobRepository {
    if (!this._reminderJobRepository) {
      this._reminderJobRepository = new ReminderJobRepository();
    }
    return this._reminderJobRepository;
  }

  /**
   * Perform health check on all active repositories
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    repositories: Record<string, { status: 'healthy' | 'unhealthy'; latency: number; error?: string }>;
  }> {
    const repositories: Record<string, { status: 'healthy' | 'unhealthy'; latency: number; error?: string }> = {};
    
    // Get list of active repositories
    const activeRepos = [
      { name: 'users', repo: this._userRepository },
      { name: 'invoices', repo: this._invoiceRepository },
      { name: 'payments', repo: this._paymentRepository },
      { name: 'payrollBatches', repo: this._payrollBatchRepository },
      { name: 'organizations', repo: this._organizationRepository },
      { name: 'blockchainNetworks', repo: this._blockchainNetworkRepository },
      { name: 'tokens', repo: this._tokenRepository },
      { name: 'smartContracts', repo: this._smartContractRepository },
      { name: 'organizationSettings', repo: this._organizationSettingRepository },
      { name: 'auditLogs', repo: this._auditLogRepository },
      { name: 'templates', repo: this._templateRepository },
      { name: 'templateCategories', repo: this._templateCategoryRepository },
      { name: 'invoiceAccessTokens', repo: this._invoiceAccessTokenRepository },
      { name: 'notificationQueue', repo: this._notificationQueueRepository },
      { name: 'notificationSettings', repo: this._notificationSettingsRepository },
      { name: 'paymentVerificationJobs', repo: this._paymentVerificationJobRepository },
      { name: 'reminderJobs', repo: this._reminderJobRepository },
    ].filter(item => item.repo !== undefined);

    // Run health checks in parallel
    const healthChecks = activeRepos.map(async ({ name, repo }) => {
      try {
        const health = await repo!.healthCheck();
        repositories[name] = health;
        return health.status === 'healthy';
      } catch (error: any) {
        repositories[name] = {
          status: 'unhealthy',
          latency: 0,
          error: error.message,
        };
        return false;
      }
    });

    const results = await Promise.all(healthChecks);
    const allHealthy = results.every(healthy => healthy);

    const overallStatus = allHealthy ? 'healthy' : 'unhealthy';
    
    this.logger.info('Repository health check completed', {
      status: overallStatus,
      activeRepositories: activeRepos.length,
      healthyRepositories: results.filter(healthy => healthy).length,
    });

    return {
      status: overallStatus,
      repositories,
    };
  }

  /**
   * Clear all repository instances (useful for testing)
   */
  clearInstances(): void {
    this._userRepository = undefined;
    this._invoiceRepository = undefined;
    this._paymentRepository = undefined;
    this._payrollBatchRepository = undefined;
    this._organizationRepository = undefined;
    this._blockchainNetworkRepository = undefined;
    this._tokenRepository = undefined;
    this._smartContractRepository = undefined;
    this._organizationSettingRepository = undefined;
    this._auditLogRepository = undefined;
    this._templateRepository = undefined;
    this._templateCategoryRepository = undefined;
    this._invoiceAccessTokenRepository = undefined;
    this._notificationQueueRepository = undefined;
    this._notificationSettingsRepository = undefined;
    this._paymentVerificationJobRepository = undefined;
    this._reminderJobRepository = undefined;

    this.logger.debug('Repository instances cleared');
  }
}

// Export singleton instance
export const repositories = RepositoryManager.getInstance();

// Export individual repository classes for direct use if needed
export {
  UserRepository,
  InvoiceRepository,
  PaymentRepository,
  PayrollBatchRepository,
  OrganizationRepository,
  BlockchainNetworkRepository,
  TokenRepository,
  SmartContractRepository,
  OrganizationSettingRepository,
  AuditLogRepository,
  TemplateRepository,
  TemplateCategoryRepository,
  InvoiceAccessTokenRepository,
  NotificationQueueRepository,
  NotificationSettingsRepository,
  PaymentVerificationJobRepository,
  ReminderJobRepository,
};

// Export BaseRepository separately
export { BaseRepository } from './BaseRepository';

// Export repository manager class
export { RepositoryManager };

// Default export
export default repositories;