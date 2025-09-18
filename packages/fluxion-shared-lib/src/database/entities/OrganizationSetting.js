"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var OrganizationSetting_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationSetting = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
let OrganizationSetting = OrganizationSetting_1 = class OrganizationSetting {
    // Computed properties
    get displayKey() {
        return this.settingKey
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    get isSecure() {
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
    getValue() {
        // In a real implementation, you would decrypt encrypted values here
        if (this.isEncrypted) {
            // Decrypt using proper encryption service
            return this.settingValue; // Placeholder
        }
        return this.settingValue;
    }
    setValue(value, encrypt = false) {
        if (encrypt || this.isSensitiveKey()) {
            // In a real implementation, you would encrypt sensitive values here
            this.settingValue = value; // Placeholder
            this.isEncrypted = true;
        }
        else {
            this.settingValue = value;
            this.isEncrypted = false;
        }
    }
    isSensitiveKey() {
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
    static getDefaultSettings() {
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
    static getSystemSettings() {
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
    static validateSettingKey(key) {
        return /^[a-z][a-z0-9_]*[a-z0-9]$/.test(key) && key.length <= 100;
    }
    static validateSettingValue(value) {
        try {
            JSON.stringify(value);
            return true;
        }
        catch {
            return false;
        }
    }
    // Helper methods for specific setting types
    static getInvoiceSettings(settings) {
        const setting = settings.find(s => s.settingKey === 'invoice_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'invoice_settings')?.value;
    }
    static getPayrollSettings(settings) {
        const setting = settings.find(s => s.settingKey === 'payroll_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'payroll_settings')?.value;
    }
    static getNotificationSettings(settings) {
        const setting = settings.find(s => s.settingKey === 'notification_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'notification_settings')?.value;
    }
    static getSecuritySettings(settings) {
        const setting = settings.find(s => s.settingKey === 'security_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'security_settings')?.value;
    }
    static getThemeSettings(settings) {
        const setting = settings.find(s => s.settingKey === 'theme_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'theme_settings')?.value;
    }
    static getIntegrationSettings(settings) {
        const setting = settings.find(s => s.settingKey === 'integration_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'integration_settings')?.value;
    }
    static getComplianceSettings(settings) {
        const setting = settings.find(s => s.settingKey === 'compliance_settings');
        return setting ? setting.getValue() : OrganizationSetting_1.getDefaultSettings()
            .find(s => s.key === 'compliance_settings')?.value;
    }
    // Merge user settings with defaults
    static mergeWithDefaults(userSettings, defaults) {
        const result = { ...defaults };
        userSettings.forEach(setting => {
            if (typeof result[setting.settingKey] === 'object' && result[setting.settingKey] !== null) {
                result[setting.settingKey] = { ...result[setting.settingKey], ...setting.getValue() };
            }
            else {
                result[setting.settingKey] = setting.getValue();
            }
        });
        return result;
    }
};
exports.OrganizationSetting = OrganizationSetting;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationSetting.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], OrganizationSetting.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'setting_key', type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], OrganizationSetting.prototype, "settingKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'setting_value', type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], OrganizationSetting.prototype, "settingValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_encrypted', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], OrganizationSetting.prototype, "isEncrypted", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], OrganizationSetting.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], OrganizationSetting.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.organizationSettings, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationSetting.prototype, "organization", void 0);
exports.OrganizationSetting = OrganizationSetting = OrganizationSetting_1 = __decorate([
    (0, typeorm_1.Entity)('organization_settings'),
    (0, typeorm_1.Index)(['organizationId', 'settingKey'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['settingKey'])
], OrganizationSetting);
//# sourceMappingURL=OrganizationSetting.js.map