import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';

@Entity('organization_settings')
@Index(['organizationId', 'settingKey'], { unique: true })
@Index(['organizationId'])
@Index(['settingKey'])
export class OrganizationSetting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: false })
  organizationId!: string;

  @Column({ name: 'setting_key', type: 'varchar', length: 100, nullable: false })
  settingKey!: string;

  @Column({ name: 'setting_value', type: 'jsonb', nullable: false })
  settingValue!: any;

  @Column({ name: 'is_encrypted', type: 'boolean', default: false })
  isEncrypted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.organizationSettings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  // Computed properties
  get displayKey(): string {
    return this.settingKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  get isSecure(): boolean {
    return this.isEncrypted || this.isSensitiveKey();
  }

  // Methods
  toJSON() {
    return {
      ...this,
      displayKey: this.displayKey,
      isSecure: this.isSecure,
      // Don't expose sensitive values in JSON
      settingValue: this.isSecure ? '[ENCRYPTED]' : this.settingValue,
    };
  }

  getValue(): any {
    // In a real implementation, you would decrypt encrypted values here
    if (this.isEncrypted) {
      // Decrypt using proper encryption service
      return this.settingValue; // Placeholder
    }
    return this.settingValue;
  }

  setValue(value: any, encrypt = false): void {
    if (encrypt || this.isSensitiveKey()) {
      // In a real implementation, you would encrypt sensitive values here
      this.settingValue = value; // Placeholder
      this.isEncrypted = true;
    } else {
      this.settingValue = value;
      this.isEncrypted = false;
    }
  }

  private isSensitiveKey(): boolean {
    const sensitiveKeys = [
      'api_keys',
      'webhook_secrets',
      'private_keys',
      'database_credentials',
      'smtp_password',
      'oauth_secrets',
    ];
    
    return sensitiveKeys.some(key => this.settingKey.includes(key));
  }

  // Static methods for common settings
  static getDefaultSettings(): Array<{ key: string; value: any; encrypted?: boolean }> {
    return [
      {
        key: 'default_network',
        value: 'polygon',
      },
      {
        key: 'default_token',
        value: 'USDC',
      },
      {
        key: 'invoice_settings',
        value: {
          defaultDueDays: 30,
          taxRate: 0,
          currency: 'USD',
          logoUrl: null,
          footerText: null,
          reminderDays: [7, 3, 1],
        },
      },
      {
        key: 'payroll_settings',
        value: {
          defaultNetwork: 'polygon',
          defaultToken: 'USDC',
          batchSize: 100,
          gasLimitMultiplier: 1.2,
          requireApproval: true,
        },
      },
      {
        key: 'notification_settings',
        value: {
          emailEnabled: true,
          webhookEnabled: false,
          slackEnabled: false,
          discordEnabled: false,
        },
      },
      {
        key: 'security_settings',
        value: {
          requireTwoFactor: false,
          sessionTimeout: 24, // hours
          maxLoginAttempts: 5,
          requireWalletSignature: true,
        },
      },
      {
        key: 'theme_settings',
        value: {
          primaryColor: '#6366f1',
          darkMode: false,
          compactMode: false,
        },
      },
      {
        key: 'integration_settings',
        value: {
          quickbooksEnabled: false,
          xeroEnabled: false,
          zapierEnabled: false,
        },
      },
      {
        key: 'compliance_settings',
        value: {
          taxReportingEnabled: true,
          auditLoggingEnabled: true,
          dataRetentionDays: 2555, // ~7 years
        },
      },
    ];
  }

  static getSystemSettings(): Array<{ key: string; value: any; encrypted?: boolean }> {
    return [
      {
        key: 'api_keys',
        value: {
          alchemyApiKey: null,
          infuraApiKey: null,
          etherscanApiKey: null,
          polygonscanApiKey: null,
        },
        encrypted: true,
      },
      {
        key: 'webhook_endpoints',
        value: {
          internalWebhook: null,
          externalWebhooks: [],
        },
      },
      {
        key: 'rate_limits',
        value: {
          apiCallsPerMinute: 100,
          transactionsPerHour: 50,
          emailsPerDay: 1000,
        },
      },
      {
        key: 'feature_flags',
        value: {
          escrowEnabled: false,
          subscriptionsEnabled: false,
          multisigEnabled: false,
          crossChainEnabled: false,
        },
      },
    ];
  }

  static validateSettingKey(key: string): boolean {
    return /^[a-z][a-z0-9_]*[a-z0-9]$/.test(key) && key.length <= 100;
  }

  static validateSettingValue(value: any): boolean {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  // Helper methods for specific setting types
  static getInvoiceSettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'invoice_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'invoice_settings')?.value;
  }

  static getPayrollSettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'payroll_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'payroll_settings')?.value;
  }

  static getNotificationSettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'notification_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'notification_settings')?.value;
  }

  static getSecuritySettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'security_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'security_settings')?.value;
  }

  static getThemeSettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'theme_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'theme_settings')?.value;
  }

  static getIntegrationSettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'integration_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'integration_settings')?.value;
  }

  static getComplianceSettings(settings: OrganizationSetting[]): any {
    const setting = settings.find(s => s.settingKey === 'compliance_settings');
    return setting ? setting.getValue() : OrganizationSetting.getDefaultSettings()
      .find(s => s.key === 'compliance_settings')?.value;
  }

  // Merge user settings with defaults
  static mergeWithDefaults(userSettings: OrganizationSetting[], defaults: any): any {
    const result = { ...defaults };
    
    userSettings.forEach(setting => {
      if (typeof result[setting.settingKey] === 'object' && result[setting.settingKey] !== null) {
        result[setting.settingKey] = { ...result[setting.settingKey], ...setting.getValue() };
      } else {
        result[setting.settingKey] = setting.getValue();
      }
    });
    
    return result;
  }
}