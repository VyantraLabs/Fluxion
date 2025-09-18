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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationSettings = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
let NotificationSettings = class NotificationSettings {
    // Computed properties
    get canReceiveEmails() {
        return !this.globalUnsubscribe &&
            this.emailVerified &&
            !(this.metadata.suppressionList);
    }
    get hasHighBounceRate() {
        const bounceCount = this.metadata.bounceCount || 0;
        return bounceCount > 5; // Threshold for high bounce rate
    }
    get hasHighComplaintRate() {
        const complaintsCount = this.metadata.complaintsCount || 0;
        return complaintsCount > 2; // Threshold for high complaint rate
    }
    get shouldSuppressEmails() {
        return this.globalUnsubscribe ||
            !this.emailVerified ||
            this.hasHighBounceRate ||
            this.hasHighComplaintRate ||
            !!this.metadata.suppressionList;
    }
    get isWebhookConfigured() {
        return this.webhookSettings.enabled &&
            !!this.webhookSettings.url &&
            this.webhookSettings.events.length > 0;
    }
    get activeIntegrations() {
        const integrations = this.integrationSettings.customIntegrations || [];
        return integrations.filter(i => i.active).length;
    }
    // Methods
    updateEmailSettings(settings) {
        this.emailSettings = { ...this.emailSettings, ...settings };
    }
    updateReminderSettings(settings) {
        this.reminderSettings = { ...this.reminderSettings, ...settings };
    }
    updateTemplateSettings(settings) {
        this.templateSettings = { ...this.templateSettings, ...settings };
    }
    updateWebhookSettings(settings) {
        this.webhookSettings = { ...this.webhookSettings, ...settings };
    }
    enableNotificationType(type) {
        this.emailSettings[type] = true;
    }
    disableNotificationType(type) {
        this.emailSettings[type] = false;
    }
    subscribeToAll() {
        this.globalUnsubscribe = false;
        Object.keys(this.emailSettings).forEach(key => {
            if (key !== 'marketingEmails') { // Keep marketing emails separate
                this.emailSettings[key] = true;
            }
        });
    }
    unsubscribeFromAll(reason) {
        this.globalUnsubscribe = true;
        if (reason) {
            if (!this.metadata.optOutReasons) {
                this.metadata.optOutReasons = [];
            }
            this.metadata.optOutReasons.push(reason);
            this.metadata.optOutDate = new Date().toISOString();
        }
    }
    recordBounce() {
        this.metadata.bounceCount = (this.metadata.bounceCount || 0) + 1;
        this.metadata.lastBounceDate = new Date().toISOString();
        // Auto-suppress after too many bounces
        if (this.metadata.bounceCount > 5) {
            this.metadata.suppressionList = true;
        }
    }
    recordComplaint() {
        this.metadata.complaintsCount = (this.metadata.complaintsCount || 0) + 1;
        this.metadata.lastComplaintDate = new Date().toISOString();
        // Auto-suppress after complaints
        if (this.metadata.complaintsCount > 2) {
            this.metadata.suppressionList = true;
            this.globalUnsubscribe = true;
        }
    }
    generateEmailVerificationToken() {
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');
        this.emailVerificationToken = token;
        this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        return token;
    }
    verifyEmail(token) {
        if (!this.emailVerificationToken ||
            !this.emailVerificationExpires ||
            new Date() > this.emailVerificationExpires) {
            return false;
        }
        if (this.emailVerificationToken !== token) {
            return false;
        }
        this.emailVerified = true;
        this.emailVerificationToken = undefined;
        this.emailVerificationExpires = undefined;
        this.metadata.suppressionList = false;
        return true;
    }
    addCustomIntegration(integration) {
        if (!this.integrationSettings.customIntegrations) {
            this.integrationSettings.customIntegrations = [];
        }
        this.integrationSettings.customIntegrations.push({
            ...integration,
            active: integration.active ?? true,
        });
    }
    removeCustomIntegration(name) {
        if (this.integrationSettings.customIntegrations) {
            this.integrationSettings.customIntegrations =
                this.integrationSettings.customIntegrations.filter(i => i.name !== name);
        }
    }
    setReminderSchedule(intervals, overdueIntervals) {
        this.reminderSettings = {
            ...this.reminderSettings,
            intervals,
            overdueIntervals,
        };
    }
    // Static factory methods
    static createDefault(organizationId, userId) {
        return {
            organizationId,
            userId,
            emailSettings: {
                invoicesSent: true,
                paymentsReceived: true,
                paymentsFailed: true,
                reminders: true,
                overdue: true,
                partialPayments: true,
                invoiceViewed: false,
                invoiceCancelled: true,
                systemUpdates: true,
                marketingEmails: false,
            },
            reminderSettings: {
                enabled: true,
                intervals: [7, 3, 1], // 7, 3, and 1 days before due date
                overdueIntervals: [1, 7, 14], // 1, 7, and 14 days after due date
                maxReminders: 5,
                reminderTime: '09:00',
                timezone: 'UTC',
                businessDaysOnly: false,
                excludeWeekends: false,
            },
            templateSettings: {
                fromName: 'Fluxion',
                signature: 'Best regards,\nThe Fluxion Team',
                brandColor: '#2563eb',
                unsubscribeText: 'You can unsubscribe from these notifications at any time.',
            },
            webhookSettings: {
                enabled: false,
                events: [],
                retryAttempts: 3,
                timeout: 30,
            },
            integrationSettings: {},
            globalUnsubscribe: false,
            emailVerified: false,
            preferredLanguage: 'en',
            preferredTimezone: 'UTC',
            metadata: {},
        };
    }
    // JSON serialization
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            userId: this.userId,
            emailSettings: this.emailSettings,
            reminderSettings: this.reminderSettings,
            templateSettings: {
                ...this.templateSettings,
                // Don't expose sensitive webhook secrets in JSON
            },
            webhookSettings: {
                ...this.webhookSettings,
                secret: this.webhookSettings.secret ? '***' : undefined,
            },
            integrationSettings: this.integrationSettings,
            globalUnsubscribe: this.globalUnsubscribe,
            emailVerified: this.emailVerified,
            preferredLanguage: this.preferredLanguage,
            preferredTimezone: this.preferredTimezone,
            lastNotificationSent: this.lastNotificationSent,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Computed properties
            canReceiveEmails: this.canReceiveEmails,
            hasHighBounceRate: this.hasHighBounceRate,
            hasHighComplaintRate: this.hasHighComplaintRate,
            shouldSuppressEmails: this.shouldSuppressEmails,
            isWebhookConfigured: this.isWebhookConfigured,
            activeIntegrations: this.activeIntegrations,
            metadata: {
                ...this.metadata,
                // Don't expose email verification token
                emailVerificationToken: undefined,
            },
        };
    }
    // Public JSON (minimal data for client-side)
    toPublicJSON() {
        return {
            emailSettings: this.emailSettings,
            reminderSettings: {
                enabled: this.reminderSettings.enabled,
                intervals: this.reminderSettings.intervals,
                reminderTime: this.reminderSettings.reminderTime,
                timezone: this.reminderSettings.timezone,
            },
            globalUnsubscribe: this.globalUnsubscribe,
            emailVerified: this.emailVerified,
            preferredLanguage: this.preferredLanguage,
            preferredTimezone: this.preferredTimezone,
            canReceiveEmails: this.canReceiveEmails,
        };
    }
};
exports.NotificationSettings = NotificationSettings;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], NotificationSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], NotificationSettings.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], NotificationSettings.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_settings', type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], NotificationSettings.prototype, "emailSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reminder_settings', type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], NotificationSettings.prototype, "reminderSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'template_settings', type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], NotificationSettings.prototype, "templateSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'webhook_settings', type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], NotificationSettings.prototype, "webhookSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'integration_settings', type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], NotificationSettings.prototype, "integrationSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'global_unsubscribe', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], NotificationSettings.prototype, "globalUnsubscribe", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_verified', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], NotificationSettings.prototype, "emailVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_verification_token', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", String)
], NotificationSettings.prototype, "emailVerificationToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_verification_expires', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], NotificationSettings.prototype, "emailVerificationExpires", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'preferred_language', type: 'varchar', length: 10, default: 'en' }),
    __metadata("design:type", String)
], NotificationSettings.prototype, "preferredLanguage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'preferred_timezone', type: 'varchar', length: 50, default: 'UTC' }),
    __metadata("design:type", String)
], NotificationSettings.prototype, "preferredTimezone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_notification_sent', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], NotificationSettings.prototype, "lastNotificationSent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], NotificationSettings.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], NotificationSettings.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], NotificationSettings.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.notificationSettings, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], NotificationSettings.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.notificationSettings, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_1.User)
], NotificationSettings.prototype, "user", void 0);
exports.NotificationSettings = NotificationSettings = __decorate([
    (0, typeorm_1.Entity)('notification_settings'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['organizationId', 'userId'], { unique: true })
], NotificationSettings);
//# sourceMappingURL=NotificationSettings.js.map