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
exports.Invoice = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
const BlockchainNetwork_1 = require("./BlockchainNetwork");
const Token_1 = require("./Token");
const Payment_1 = require("./Payment");
const Template_1 = require("./Template");
const InvoiceAccessToken_1 = require("./InvoiceAccessToken");
const NotificationQueue_1 = require("./NotificationQueue");
const PaymentVerificationJob_1 = require("./PaymentVerificationJob");
const ReminderJob_1 = require("./ReminderJob");
let Invoice = class Invoice {
    // Computed properties
    get displayAmount() {
        return this.token?.formatAmountWithSymbol(this.amount) || this.amount;
    }
    get displayAmountPaid() {
        return this.token?.formatAmountWithSymbol(this.amountPaid) || this.amountPaid;
    }
    get remainingAmount() {
        const remaining = (parseFloat(this.amount) - parseFloat(this.amountPaid)).toString();
        return remaining;
    }
    get displayRemainingAmount() {
        return this.token?.formatAmountWithSymbol(this.remainingAmount) || this.remainingAmount;
    }
    get isOverdue() {
        if (!this.dueDate || this.status === 'paid' || this.status === 'cancelled') {
            return false;
        }
        const dueDate = this.dueDate instanceof Date ? this.dueDate : new Date(this.dueDate);
        return new Date() > dueDate;
    }
    get isPaid() {
        return this.status === 'paid' || parseFloat(this.amountPaid) >= parseFloat(this.amount);
    }
    get isPartiallyPaid() {
        return parseFloat(this.amountPaid) > 0 && parseFloat(this.amountPaid) < parseFloat(this.amount);
    }
    get paymentProgress() {
        return Math.min((parseFloat(this.amountPaid) / parseFloat(this.amount)) * 100, 100);
    }
    get daysUntilDue() {
        if (!this.dueDate)
            return null;
        const today = new Date();
        const dueDate = this.dueDate instanceof Date ? this.dueDate : new Date(this.dueDate);
        const timeDiff = dueDate.getTime() - today.getTime();
        return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }
    get clientDisplayName() {
        return this.clientName || this.clientEmail || this.clientWallet || 'Unknown Client';
    }
    get hasTemplate() {
        return !!this.templateId;
    }
    get hasAccessTokens() {
        return this.accessTokens?.length > 0;
    }
    get activeAccessTokens() {
        return this.accessTokens?.filter(token => token.isValid) || [];
    }
    get hasActiveAccessToken() {
        return this.activeAccessTokens.length > 0;
    }
    get pendingVerificationJobs() {
        return this.verificationJobs?.filter(job => job.isPending) || [];
    }
    get completedVerificationJobs() {
        return this.verificationJobs?.filter(job => job.isCompleted) || [];
    }
    get hasQRCode() {
        return !!this.qrCodeData;
    }
    get allowsPartialPayments() {
        return this.clientSettings?.allowPartialPayments ?? true;
    }
    get requiresClientEmail() {
        return this.clientSettings?.requireClientEmail ?? false;
    }
    get notificationsEnabled() {
        return this.clientSettings?.notificationsEnabled ?? true;
    }
    get viewCount() {
        return this.clientSettings?.viewCount || 0;
    }
    get remindersSent() {
        return this.clientSettings?.remindersSent || 0;
    }
    get activeReminders() {
        return this.reminderJobs?.filter(reminder => ['scheduled', 'pending'].includes(reminder.status)) || [];
    }
    get sentReminders() {
        return this.reminderJobs?.filter(reminder => reminder.status === 'sent') || [];
    }
    get hasActiveReminders() {
        return this.activeReminders.length > 0;
    }
    get nextReminderDate() {
        const activeReminders = this.activeReminders;
        if (activeReminders.length === 0)
            return null;
        const sortedReminders = activeReminders.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
        return sortedReminders[0].scheduledFor;
    }
    // Methods
    toJSON() {
        const { deletedAt, ...rest } = this;
        return {
            ...rest,
            displayAmount: this.displayAmount,
            displayAmountPaid: this.displayAmountPaid,
            remainingAmount: this.remainingAmount,
            displayRemainingAmount: this.displayRemainingAmount,
            isOverdue: this.isOverdue,
            isPaid: this.isPaid,
            isPartiallyPaid: this.isPartiallyPaid,
            paymentProgress: this.paymentProgress,
            daysUntilDue: this.daysUntilDue,
            clientDisplayName: this.clientDisplayName,
            // New computed properties
            hasTemplate: this.hasTemplate,
            hasAccessTokens: this.hasAccessTokens,
            hasActiveAccessToken: this.hasActiveAccessToken,
            hasQRCode: this.hasQRCode,
            allowsPartialPayments: this.allowsPartialPayments,
            requiresClientEmail: this.requiresClientEmail,
            notificationsEnabled: this.notificationsEnabled,
            viewCount: this.viewCount,
            remindersSent: this.remindersSent,
            // Relations counts
            accessTokensCount: this.accessTokens?.length || 0,
            activeAccessTokensCount: this.activeAccessTokens.length,
            verificationJobsCount: this.verificationJobs?.length || 0,
            pendingVerificationJobsCount: this.pendingVerificationJobs.length,
            // Reminder properties
            hasActiveReminders: this.hasActiveReminders,
            nextReminderDate: this.nextReminderDate,
            activeRemindersCount: this.activeReminders.length,
            sentRemindersCount: this.sentReminders.length,
        };
    }
    addPayment(paymentAmount) {
        const currentPaid = parseFloat(this.amountPaid);
        const newPayment = parseFloat(paymentAmount);
        const totalAmount = parseFloat(this.amount);
        this.amountPaid = (currentPaid + newPayment).toString();
        if (currentPaid + newPayment >= totalAmount) {
            this.status = 'paid';
            this.paidAt = new Date();
        }
        else if (currentPaid + newPayment > 0) {
            this.status = 'partial';
        }
    }
    markAsSent() {
        if (this.status === 'draft') {
            this.status = 'sent';
            this.sentAt = new Date();
        }
    }
    markAsOverdue() {
        if (this.status === 'sent' || this.status === 'partial') {
            this.status = 'overdue';
        }
    }
    cancel(reason) {
        this.status = 'cancelled';
        if (reason) {
            this.metadata = { ...this.metadata, cancellationReason: reason };
        }
    }
    // New methods for enhanced functionality
    recordView() {
        this.clientSettings = {
            ...this.clientSettings,
            viewCount: (this.clientSettings?.viewCount || 0) + 1,
            lastViewedAt: new Date().toISOString(),
        };
    }
    incrementRemindersSent() {
        this.clientSettings = {
            ...this.clientSettings,
            remindersSent: (this.clientSettings?.remindersSent || 0) + 1,
            lastNotificationSent: new Date().toISOString(),
        };
    }
    setQRCodeData(qrData) {
        this.qrCodeData = qrData;
    }
    setMobilePaymentUrl(url) {
        this.mobilePaymentUrl = url;
    }
    enableClientAccess() {
        this.clientSettings = {
            ...this.clientSettings,
            accessTokenEnabled: true,
        };
    }
    disableClientAccess() {
        this.clientSettings = {
            ...this.clientSettings,
            accessTokenEnabled: false,
        };
    }
    setCustomMessage(message) {
        this.clientSettings = {
            ...this.clientSettings,
            customMessage: message,
        };
    }
    applyTemplateData(template) {
        this.templateId = template.id;
        const config = template.getConfiguration();
        const defaults = template.content?.defaults || {};
        // Apply template defaults
        if (defaults.title && !this.title) {
            this.title = defaults.title;
        }
        if (defaults.description && !this.description) {
            this.description = defaults.description;
        }
        if (defaults.chainId && !this.chainId) {
            this.chainId = defaults.chainId;
        }
        if (defaults.tokenId && !this.tokenId) {
            this.tokenId = defaults.tokenId;
        }
        // Apply template configuration
        this.metadata = {
            ...this.metadata,
            templateData: config.customFields || {},
            branding: config.branding,
            paymentInstructions: config.paymentInstructions,
            terms: config.terms,
        };
        this.clientSettings = {
            ...this.clientSettings,
            allowPartialPayments: config.allowPartialPayments ?? true,
            requireClientEmail: config.requireClientEmail ?? false,
            notificationsEnabled: config.autoReminders ?? true,
        };
        if (config.autoReminders && config.reminderIntervals) {
            this.metadata = {
                ...this.metadata,
                notificationPreferences: {
                    sendReminders: true,
                    reminderIntervals: config.reminderIntervals,
                },
            };
        }
    }
    // Static methods
    static generateInvoiceNumber(organizationSlug, sequence) {
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const seq = String(sequence).padStart(4, '0');
        return `${organizationSlug.toUpperCase()}-${year}${month}-${seq}`;
    }
    static validateInvoiceNumber(invoiceNumber) {
        return /^[A-Z0-9-]+$/.test(invoiceNumber);
    }
    static validateAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num > 0;
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static validateWalletAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    static validateStatus(status) {
        return ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'].includes(status);
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.Invoice = Invoice;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Invoice.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], Invoice.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], Invoice.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_number', type: 'varchar', length: 50, nullable: false }),
    __metadata("design:type", String)
], Invoice.prototype, "invoiceNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], Invoice.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_date', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Invoice.prototype, "dueDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "clientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_email', type: 'varchar', length: 320, nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "clientEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_wallet', type: 'varchar', length: 42, nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "clientWallet", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chain_id', type: 'integer', nullable: false }),
    __metadata("design:type", Number)
], Invoice.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], Invoice.prototype, "tokenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 36, scale: 18, nullable: false }),
    __metadata("design:type", String)
], Invoice.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'amount_paid', type: 'decimal', precision: 36, scale: 18, default: '0' }),
    __metadata("design:type", String)
], Invoice.prototype, "amountPaid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'template_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "templateId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'draft',
        nullable: false,
    }),
    __metadata("design:type", String)
], Invoice.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], Invoice.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_settings', type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], Invoice.prototype, "clientSettings", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'qr_code_data', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "qrCodeData", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mobile_payment_url', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Invoice.prototype, "mobilePaymentUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Invoice.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'paid_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Invoice.prototype, "paidAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Invoice.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Invoice.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], Invoice.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.invoices, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], Invoice.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.invoices, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'created_by' }),
    __metadata("design:type", User_1.User)
], Invoice.prototype, "createdByUser", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BlockchainNetwork_1.BlockchainNetwork, network => network.invoices, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'chain_id' }),
    __metadata("design:type", BlockchainNetwork_1.BlockchainNetwork)
], Invoice.prototype, "network", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Token_1.Token, token => token.invoices, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'token_id' }),
    __metadata("design:type", Token_1.Token)
], Invoice.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payment, payment => payment.invoice, { cascade: true }),
    __metadata("design:type", Array)
], Invoice.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Template_1.Template, template => template.invoices, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'template_id' }),
    __metadata("design:type", Template_1.Template)
], Invoice.prototype, "template", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => InvoiceAccessToken_1.InvoiceAccessToken, token => token.invoice, { cascade: true }),
    __metadata("design:type", Array)
], Invoice.prototype, "accessTokens", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => NotificationQueue_1.NotificationQueue, notification => notification.invoiceId),
    __metadata("design:type", Array)
], Invoice.prototype, "notifications", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PaymentVerificationJob_1.PaymentVerificationJob, job => job.invoice, { cascade: true }),
    __metadata("design:type", Array)
], Invoice.prototype, "verificationJobs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ReminderJob_1.ReminderJob, reminder => reminder.invoice, { cascade: true }),
    __metadata("design:type", Array)
], Invoice.prototype, "reminderJobs", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Invoice.prototype, "generateId", null);
exports.Invoice = Invoice = __decorate([
    (0, typeorm_1.Entity)('invoices'),
    (0, typeorm_1.Index)(['invoiceNumber', 'organizationId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['createdBy']),
    (0, typeorm_1.Index)(['chainId']),
    (0, typeorm_1.Index)(['tokenId']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['dueDate']),
    (0, typeorm_1.Index)(['clientEmail']),
    (0, typeorm_1.Check)('amount_positive', 'amount > 0'),
    (0, typeorm_1.Check)('client_wallet_format', "client_wallet ~* '^0x[a-fA-F0-9]{40}$' OR client_wallet IS NULL"),
    (0, typeorm_1.Check)('status_valid', "status IN ('draft', 'created', 'initiated', 'sent', 'paid', 'overdue', 'cancelled', 'partial')")
], Invoice);
//# sourceMappingURL=Invoice.js.map