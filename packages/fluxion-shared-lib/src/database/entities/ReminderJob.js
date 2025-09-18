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
exports.ReminderJob = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const Invoice_1 = require("./Invoice");
const User_1 = require("./User");
let ReminderJob = class ReminderJob {
    // Computed properties
    get isDue() {
        return new Date() >= this.scheduledFor && this.status === 'scheduled';
    }
    get canRetry() {
        return this.status === 'failed' &&
            this.retryCount < this.maxRetries &&
            (!this.nextRetryAt || new Date() >= this.nextRetryAt);
    }
    get hasReachedMaxOccurrences() {
        return !!(this.maxOccurrences && this.occurrenceCount >= this.maxOccurrences);
    }
    get isRecurring() {
        return !this.maxOccurrences || this.maxOccurrences > 1;
    }
    get nextScheduledDate() {
        if (!this.isRecurring || this.hasReachedMaxOccurrences) {
            return null;
        }
        const config = this.configuration;
        const baseDate = new Date(this.scheduledFor);
        // For recurring reminders, calculate next occurrence
        if (config.isOverdueReminder) {
            // Overdue reminders: add interval days after the previous reminder
            baseDate.setDate(baseDate.getDate() + config.intervalDays);
        }
        else {
            // Due date reminders: not typically recurring, but handle edge cases
            return null;
        }
        return baseDate;
    }
    // Methods
    markAsProcessing() {
        this.status = 'processing';
    }
    markAsSent(notificationId) {
        this.status = 'sent';
        this.sentAt = new Date();
        this.occurrenceCount += 1;
        if (notificationId) {
            this.notificationId = notificationId;
        }
        this.recordDeliveryAttempt('email', 'success');
        // Schedule next occurrence if this is recurring
        const nextDate = this.nextScheduledDate;
        if (nextDate && !this.hasReachedMaxOccurrences) {
            this.scheduleNextOccurrence(nextDate);
        }
    }
    markAsFailed(error, errorCode) {
        this.status = 'failed';
        this.errorMessage = error;
        this.errorCode = errorCode;
        this.retryCount += 1;
        this.recordDeliveryAttempt('email', 'failed', error);
        if (this.canRetry) {
            this.scheduleRetry();
        }
    }
    markAsCancelled(reason) {
        this.status = 'cancelled';
        if (reason) {
            this.metadata = {
                ...this.metadata,
                skipReasons: [...(this.metadata.skipReasons || []), reason],
            };
        }
    }
    markAsSkipped(reason) {
        this.status = 'skipped';
        this.metadata = {
            ...this.metadata,
            skipReasons: [...(this.metadata.skipReasons || []), reason],
        };
    }
    scheduleRetry(delayMinutes) {
        if (this.retryCount >= this.maxRetries) {
            return;
        }
        // Exponential backoff: 5, 15, 45 minutes
        const delay = delayMinutes || Math.pow(3, this.retryCount) * 5;
        this.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
        this.status = 'scheduled';
    }
    scheduleNextOccurrence(date) {
        this.scheduledFor = date;
        this.status = 'scheduled';
        this.sentAt = undefined;
        this.errorMessage = undefined;
        this.errorCode = undefined;
        this.retryCount = 0;
        this.nextRetryAt = undefined;
    }
    reschedule(newDate) {
        if (this.status === 'processing') {
            throw new Error('Cannot reschedule reminder that is currently processing');
        }
        this.scheduledFor = newDate;
        if (this.status === 'failed' || this.status === 'cancelled') {
            this.status = 'scheduled';
            this.errorMessage = undefined;
            this.errorCode = undefined;
            this.retryCount = 0;
        }
    }
    updateConfiguration(config) {
        this.configuration = { ...this.configuration, ...config };
    }
    recordDeliveryAttempt(method, status, error) {
        if (!this.metadata.deliveryAttempts) {
            this.metadata.deliveryAttempts = [];
        }
        this.metadata.deliveryAttempts.push({
            timestamp: new Date().toISOString(),
            method,
            status,
            error,
        });
        // Keep only last 10 delivery attempts
        if (this.metadata.deliveryAttempts.length > 10) {
            this.metadata.deliveryAttempts = this.metadata.deliveryAttempts.slice(-10);
        }
    }
    // Static factory methods
    static createDueDateReminder(organizationId, invoiceId, daysBefore, configuration = {}) {
        const defaultConfig = {
            intervalDays: daysBefore,
            isOverdueReminder: false,
            businessDaysOnly: false,
            excludeWeekends: false,
            reminderTime: '09:00',
            timezone: 'UTC',
            webhookEnabled: false,
            smsEnabled: false,
            ...configuration,
        };
        return {
            organizationId,
            invoiceId,
            type: 'due_date',
            configuration: defaultConfig,
            status: 'scheduled',
            priority: daysBefore <= 1 ? 'high' : 'normal',
            occurrenceCount: 0,
            maxOccurrences: 1, // Due date reminders typically sent once
            metadata: {
                reminderReason: `Invoice due in ${daysBefore} day(s)`,
            },
        };
    }
    static createOverdueReminder(organizationId, invoiceId, daysAfter, maxOccurrences = 3, configuration = {}) {
        const defaultConfig = {
            intervalDays: daysAfter,
            isOverdueReminder: true,
            businessDaysOnly: true,
            excludeWeekends: true,
            reminderTime: '10:00',
            timezone: 'UTC',
            webhookEnabled: true,
            smsEnabled: false,
            conditions: {
                statuses: ['overdue', 'sent'],
                excludeStatuses: ['paid', 'cancelled'],
            },
            ...configuration,
        };
        return {
            organizationId,
            invoiceId,
            type: 'overdue',
            configuration: defaultConfig,
            status: 'scheduled',
            priority: 'high',
            occurrenceCount: 0,
            maxOccurrences,
            metadata: {
                reminderReason: `Invoice overdue by ${daysAfter} day(s)`,
            },
        };
    }
    // Business logic validation
    shouldSkipReminder(invoice) {
        const config = this.configuration;
        // Check invoice status conditions
        if (config.conditions?.statuses && !config.conditions.statuses.includes(invoice.status)) {
            return { skip: true, reason: `Invoice status ${invoice.status} not in allowed statuses` };
        }
        if (config.conditions?.excludeStatuses && config.conditions.excludeStatuses.includes(invoice.status)) {
            return { skip: true, reason: `Invoice status ${invoice.status} is excluded` };
        }
        // Check amount conditions
        const amount = parseFloat(invoice.amount);
        if (config.conditions?.minAmount && amount < parseFloat(config.conditions.minAmount)) {
            return { skip: true, reason: `Invoice amount ${amount} below minimum ${config.conditions.minAmount}` };
        }
        if (config.conditions?.maxAmount && amount > parseFloat(config.conditions.maxAmount)) {
            return { skip: true, reason: `Invoice amount ${amount} above maximum ${config.conditions.maxAmount}` };
        }
        // Check if invoice is paid
        if (invoice.isPaid) {
            return { skip: true, reason: 'Invoice already paid' };
        }
        // Check if invoice is cancelled
        if (invoice.status === 'cancelled') {
            return { skip: true, reason: 'Invoice is cancelled' };
        }
        // Check max occurrences
        if (this.hasReachedMaxOccurrences) {
            return { skip: true, reason: 'Maximum reminder occurrences reached' };
        }
        return { skip: false };
    }
    // JSON serialization
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            invoiceId: this.invoiceId,
            userId: this.userId,
            type: this.type,
            status: this.status,
            priority: this.priority,
            scheduledFor: this.scheduledFor,
            sentAt: this.sentAt,
            occurrenceCount: this.occurrenceCount,
            maxOccurrences: this.maxOccurrences,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            nextRetryAt: this.nextRetryAt,
            configuration: this.configuration,
            notificationId: this.notificationId,
            errorMessage: this.errorMessage,
            errorCode: this.errorCode,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Computed properties
            isDue: this.isDue,
            canRetry: this.canRetry,
            hasReachedMaxOccurrences: this.hasReachedMaxOccurrences,
            isRecurring: this.isRecurring,
            nextScheduledDate: this.nextScheduledDate,
            metadata: this.metadata,
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.ReminderJob = ReminderJob;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], ReminderJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], ReminderJob.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], ReminderJob.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ReminderJob.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: false }),
    __metadata("design:type", String)
], ReminderJob.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'scheduled' }),
    __metadata("design:type", String)
], ReminderJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'normal' }),
    __metadata("design:type", String)
], ReminderJob.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scheduled_for', type: 'timestamptz', nullable: false }),
    __metadata("design:type", Date)
], ReminderJob.prototype, "scheduledFor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], ReminderJob.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'occurrence_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ReminderJob.prototype, "occurrenceCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_occurrences', type: 'integer', nullable: true }),
    __metadata("design:type", Number)
], ReminderJob.prototype, "maxOccurrences", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retry_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], ReminderJob.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_retries', type: 'integer', default: 3 }),
    __metadata("design:type", Number)
], ReminderJob.prototype, "maxRetries", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_retry_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], ReminderJob.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], ReminderJob.prototype, "configuration", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notification_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], ReminderJob.prototype, "notificationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], ReminderJob.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_code', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], ReminderJob.prototype, "errorCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], ReminderJob.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReminderJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ReminderJob.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.reminderJobs, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], ReminderJob.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Invoice_1.Invoice, invoice => invoice.reminderJobs, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'invoice_id' }),
    __metadata("design:type", Invoice_1.Invoice)
], ReminderJob.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_1.User)
], ReminderJob.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ReminderJob.prototype, "generateId", null);
exports.ReminderJob = ReminderJob = __decorate([
    (0, typeorm_1.Entity)('reminder_jobs'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['invoiceId']),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['type']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['priority']),
    (0, typeorm_1.Index)(['scheduledFor']),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['status', 'scheduledFor']),
    (0, typeorm_1.Index)(['invoiceId', 'type']),
    (0, typeorm_1.Check)('scheduled_for_valid', 'scheduled_for >= created_at'),
    (0, typeorm_1.Check)('occurrence_count_positive', 'occurrence_count >= 0'),
    (0, typeorm_1.Check)('max_occurrences_positive', 'max_occurrences IS NULL OR max_occurrences > 0')
], ReminderJob);
//# sourceMappingURL=ReminderJob.js.map