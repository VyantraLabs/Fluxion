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
exports.NotificationQueue = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const Invoice_1 = require("./Invoice");
const User_1 = require("./User");
let NotificationQueue = class NotificationQueue {
    // Computed properties
    get isOverdue() {
        return new Date() > this.scheduledFor && this.status === 'pending';
    }
    get canRetry() {
        return this.status === 'failed' &&
            this.retryCount < this.maxRetries &&
            (!this.nextRetryAt || new Date() >= this.nextRetryAt);
    }
    get isPending() {
        return this.status === 'pending' && new Date() >= this.scheduledFor;
    }
    get deliveryAttempts() {
        return this.metadata.deliveryAttempts?.length || 0;
    }
    get lastDeliveryAttempt() {
        const attempts = this.metadata.deliveryAttempts;
        if (!attempts || attempts.length === 0)
            return null;
        const lastAttempt = attempts[attempts.length - 1];
        return new Date(lastAttempt.timestamp);
    }
    get isHighPriority() {
        return this.priority === 'high' || this.priority === 'urgent';
    }
    // Methods
    markAsProcessing() {
        this.status = 'processing';
        this.updatedAt = new Date();
    }
    markAsSent(providerId, providerStatus) {
        this.status = 'sent';
        this.sentAt = new Date();
        if (providerId)
            this.providerId = providerId;
        if (providerStatus)
            this.providerStatus = providerStatus;
        this.recordDeliveryAttempt('sent', undefined, providerId);
    }
    markAsFailed(error, errorCode) {
        this.status = 'failed';
        this.errorMessage = error;
        this.errorCode = errorCode;
        this.retryCount += 1;
        this.recordDeliveryAttempt('failed', error);
        if (this.canRetry) {
            this.scheduleRetry();
        }
    }
    markAsCancelled() {
        this.status = 'cancelled';
        this.updatedAt = new Date();
    }
    scheduleRetry(delayMinutes) {
        if (this.retryCount >= this.maxRetries) {
            return;
        }
        // Exponential backoff: 5, 15, 45 minutes
        const delay = delayMinutes || Math.pow(3, this.retryCount) * 5;
        this.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
    }
    reschedule(newDate) {
        if (this.status === 'sent') {
            throw new Error('Cannot reschedule sent notification');
        }
        this.scheduledFor = newDate;
        if (this.status === 'failed') {
            this.status = 'pending';
            this.errorMessage = undefined;
            this.errorCode = undefined;
        }
    }
    updateTemplateData(data) {
        this.templateData = { ...this.templateData, ...data };
    }
    addTag(tag) {
        if (!this.metadata.tags) {
            this.metadata.tags = [];
        }
        if (!this.metadata.tags.includes(tag)) {
            this.metadata.tags.push(tag);
        }
    }
    removeTag(tag) {
        if (this.metadata.tags) {
            this.metadata.tags = this.metadata.tags.filter(t => t !== tag);
        }
    }
    recordEmailOpened(userAgent) {
        this.metadata.analytics = {
            ...this.metadata.analytics,
            opened: true,
            openedAt: new Date().toISOString(),
            userAgent,
        };
    }
    recordEmailClicked(userAgent) {
        this.metadata.analytics = {
            ...this.metadata.analytics,
            clicked: true,
            clickedAt: new Date().toISOString(),
            userAgent,
        };
    }
    recordDeliveryAttempt(status, error, providerId) {
        if (!this.metadata.deliveryAttempts) {
            this.metadata.deliveryAttempts = [];
        }
        this.metadata.deliveryAttempts.push({
            timestamp: new Date().toISOString(),
            status,
            error,
            providerId,
        });
        // Keep only last 10 delivery attempts
        if (this.metadata.deliveryAttempts.length > 10) {
            this.metadata.deliveryAttempts = this.metadata.deliveryAttempts.slice(-10);
        }
    }
    // Static factory methods
    static createInvoiceSent(organizationId, invoiceId, recipientEmail, templateData, scheduledFor) {
        return {
            organizationId,
            invoiceId,
            type: 'invoice_sent',
            recipientEmail,
            recipientName: templateData.recipientName,
            subject: `Invoice ${templateData.invoiceNumber} - ${templateData.invoiceTitle}`,
            emailTemplate: 'invoice_sent',
            templateData,
            priority: 'normal',
            scheduledFor: scheduledFor || new Date(),
            metadata: {
                source: 'invoice_send',
                tags: ['invoice', 'client_communication'],
            },
        };
    }
    static createPaymentReceived(organizationId, invoiceId, recipientEmail, templateData) {
        return {
            organizationId,
            invoiceId,
            type: 'payment_received',
            recipientEmail,
            recipientName: templateData.recipientName,
            subject: `Payment Received - Invoice ${templateData.invoiceNumber}`,
            emailTemplate: 'payment_received',
            templateData,
            priority: 'high',
            scheduledFor: new Date(),
            metadata: {
                source: 'payment_verification',
                tags: ['payment', 'confirmation'],
            },
        };
    }
    static createReminder(organizationId, invoiceId, recipientEmail, templateData, scheduledFor) {
        return {
            organizationId,
            invoiceId,
            type: 'reminder',
            recipientEmail,
            recipientName: templateData.recipientName,
            subject: `Reminder: Invoice ${templateData.invoiceNumber} Due ${templateData.invoiceDueDate}`,
            emailTemplate: 'invoice_reminder',
            templateData,
            priority: 'normal',
            scheduledFor,
            metadata: {
                source: 'reminder_scheduler',
                tags: ['reminder', 'due_date'],
            },
        };
    }
    // JSON serialization
    toJSON() {
        return {
            id: this.id,
            organizationId: this.organizationId,
            invoiceId: this.invoiceId,
            userId: this.userId,
            type: this.type,
            recipientEmail: this.recipientEmail,
            recipientName: this.recipientName,
            subject: this.subject,
            emailTemplate: this.emailTemplate,
            status: this.status,
            priority: this.priority,
            scheduledFor: this.scheduledFor,
            sentAt: this.sentAt,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            nextRetryAt: this.nextRetryAt,
            errorMessage: this.errorMessage,
            errorCode: this.errorCode,
            providerId: this.providerId,
            providerStatus: this.providerStatus,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Computed properties
            isOverdue: this.isOverdue,
            canRetry: this.canRetry,
            isPending: this.isPending,
            deliveryAttempts: this.deliveryAttempts,
            lastDeliveryAttempt: this.lastDeliveryAttempt,
            isHighPriority: this.isHighPriority,
            metadata: {
                ...this.metadata,
                deliveryAttempts: undefined, // Hide detailed delivery attempts in standard JSON
                deliveryAttemptsCount: this.deliveryAttempts,
            },
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.NotificationQueue = NotificationQueue;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: false }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipient_email', type: 'varchar', length: 320, nullable: false }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "recipientEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipient_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "recipientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'email_template', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "emailTemplate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'template_data', type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], NotificationQueue.prototype, "templateData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'normal' }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'scheduled_for', type: 'timestamptz', nullable: false }),
    __metadata("design:type", Date)
], NotificationQueue.prototype, "scheduledFor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], NotificationQueue.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retry_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], NotificationQueue.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_retries', type: 'integer', default: 3 }),
    __metadata("design:type", Number)
], NotificationQueue.prototype, "maxRetries", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_retry_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], NotificationQueue.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_code', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "errorCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "providerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'provider_status', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], NotificationQueue.prototype, "providerStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], NotificationQueue.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], NotificationQueue.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], NotificationQueue.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.notifications, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], NotificationQueue.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Invoice_1.Invoice, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'invoice_id' }),
    __metadata("design:type", Invoice_1.Invoice)
], NotificationQueue.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_1.User)
], NotificationQueue.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], NotificationQueue.prototype, "generateId", null);
exports.NotificationQueue = NotificationQueue = __decorate([
    (0, typeorm_1.Entity)('notification_queue'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['invoiceId']),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['type']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['priority']),
    (0, typeorm_1.Index)(['scheduledFor']),
    (0, typeorm_1.Index)(['organizationId', 'status']),
    (0, typeorm_1.Index)(['status', 'scheduledFor']),
    (0, typeorm_1.Index)(['type', 'status']),
    (0, typeorm_1.Check)('retry_count_positive', 'retry_count >= 0'),
    (0, typeorm_1.Check)('retry_count_max', 'retry_count <= 10'),
    (0, typeorm_1.Check)('scheduled_for_valid', 'scheduled_for >= created_at')
], NotificationQueue);
//# sourceMappingURL=NotificationQueue.js.map