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
exports.PaymentVerificationJob = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Invoice_1 = require("./Invoice");
const BlockchainNetwork_1 = require("./BlockchainNetwork");
const Token_1 = require("./Token");
const Payment_1 = require("./Payment");
let PaymentVerificationJob = class PaymentVerificationJob {
    // Computed properties
    get isCompleted() {
        return this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled';
    }
    get canRetry() {
        return this.status === 'failed' &&
            this.retryCount < this.maxRetries &&
            (!this.nextRetryAt || new Date() >= this.nextRetryAt);
    }
    get isPending() {
        return this.status === 'pending' ||
            (this.status === 'failed' && this.canRetry);
    }
    get processingDuration() {
        if (!this.startedAt || !this.completedAt)
            return null;
        return this.completedAt.getTime() - this.startedAt.getTime();
    }
    get confirmations() {
        return this.verificationData?.confirmations || 0;
    }
    get requiredConfirmations() {
        return this.verificationData?.requiredConfirmations || 12; // Default confirmations required
    }
    get hasMinConfirmations() {
        return this.confirmations >= this.requiredConfirmations;
    }
    get isHighPriority() {
        return this.priority === 'high' || this.priority === 'urgent';
    }
    get retryHistory() {
        return this.metadata.retryHistory || [];
    }
    get processingSteps() {
        return this.metadata.processingSteps || [];
    }
    // Methods
    start() {
        this.status = 'processing';
        this.startedAt = new Date();
        this.addProcessingStep('job_started', 'started');
    }
    markAsVerifying() {
        this.status = 'verifying';
        this.addProcessingStep('verification_started', 'started');
    }
    complete(result, transactionData, paymentId) {
        this.status = 'completed';
        this.completedAt = new Date();
        this.verificationResult = result;
        this.verificationData = transactionData;
        if (paymentId)
            this.paymentId = paymentId;
        this.addProcessingStep('verification_completed', 'completed', {
            isValid: result.isValid,
            paymentCreated: !!paymentId,
        });
    }
    fail(error, errorCode) {
        this.status = 'failed';
        this.errorMessage = error;
        this.errorCode = errorCode;
        this.retryCount += 1;
        this.recordRetryAttempt(errorCode, error);
        this.addProcessingStep('verification_failed', 'failed', { error, errorCode });
        if (this.canRetry) {
            this.scheduleRetry();
        }
    }
    cancel(reason) {
        this.status = 'cancelled';
        this.completedAt = new Date();
        this.errorMessage = reason;
        this.addProcessingStep('job_cancelled', 'completed', { reason });
    }
    scheduleRetry(delayMinutes) {
        if (this.retryCount >= this.maxRetries) {
            return;
        }
        // Exponential backoff with jitter: base 2^retry_count minutes + random jitter
        const baseDelay = delayMinutes || Math.pow(2, Math.min(this.retryCount, 8)); // Cap at 256 minutes
        const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
        const totalDelay = baseDelay + jitter;
        this.nextRetryAt = new Date(Date.now() + totalDelay * 60 * 1000);
        this.status = 'pending';
    }
    updateVerificationData(data) {
        this.verificationData = { ...this.verificationData, ...data };
    }
    recordWebhookDelivery(success, statusCode, error) {
        this.webhookDelivered = success;
        if (!this.metadata.webhookAttempts) {
            this.metadata.webhookAttempts = [];
        }
        this.metadata.webhookAttempts.push({
            timestamp: new Date().toISOString(),
            status: success ? 'success' : 'failed',
            statusCode,
            error,
        });
    }
    recordNotificationSent() {
        this.notificationSent = true;
    }
    addProcessingStep(step, status, details) {
        if (!this.metadata.processingSteps) {
            this.metadata.processingSteps = [];
        }
        const existingStep = this.metadata.processingSteps.find(s => s.step === step && s.status === 'started');
        if (existingStep && status !== 'started') {
            // Update existing step
            existingStep.status = status;
            existingStep.duration = new Date().getTime() - new Date(existingStep.timestamp).getTime();
            if (details)
                existingStep.details = details;
        }
        else {
            // Add new step
            this.metadata.processingSteps.push({
                step,
                timestamp: new Date().toISOString(),
                status,
                details,
            });
        }
        // Keep only last 20 steps to prevent unbounded growth
        if (this.metadata.processingSteps.length > 20) {
            this.metadata.processingSteps = this.metadata.processingSteps.slice(-20);
        }
    }
    recordRetryAttempt(errorCode, errorMessage) {
        if (!this.metadata.retryHistory) {
            this.metadata.retryHistory = [];
        }
        this.metadata.retryHistory.push({
            attempt: this.retryCount,
            timestamp: new Date().toISOString(),
            errorCode,
            errorMessage,
            blockNumber: this.verificationData?.blockNumber,
            confirmations: this.verificationData?.confirmations,
        });
        // Keep only last 10 retry attempts
        if (this.metadata.retryHistory.length > 10) {
            this.metadata.retryHistory = this.metadata.retryHistory.slice(-10);
        }
    }
    // Static factory methods
    static createVerificationJob(invoiceId, chainId, txHash, expectedAmount, expectedRecipient, fromAddress, tokenId, priority = 'normal') {
        return {
            invoiceId,
            chainId,
            tokenId,
            txHash: txHash.toLowerCase(),
            fromAddress: fromAddress?.toLowerCase(),
            expectedAmount,
            expectedRecipient: expectedRecipient.toLowerCase(),
            priority,
            status: 'pending',
            retryCount: 0,
            maxRetries: priority === 'urgent' ? 15 : 10,
            webhookDelivered: false,
            notificationSent: false,
            metadata: {
                source: 'api',
                submitTime: new Date().toISOString(),
                processingSteps: [],
                retryHistory: [],
            },
        };
    }
    static validateTransactionHash(txHash) {
        return /^0x[a-fA-F0-9]{64}$/.test(txHash);
    }
    static validateAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    // JSON serialization
    toJSON() {
        return {
            id: this.id,
            invoiceId: this.invoiceId,
            chainId: this.chainId,
            tokenId: this.tokenId,
            txHash: this.txHash,
            fromAddress: this.fromAddress,
            expectedAmount: this.expectedAmount,
            expectedRecipient: this.expectedRecipient,
            status: this.status,
            priority: this.priority,
            retryCount: this.retryCount,
            maxRetries: this.maxRetries,
            nextRetryAt: this.nextRetryAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            errorMessage: this.errorMessage,
            errorCode: this.errorCode,
            verificationData: this.verificationData,
            verificationResult: this.verificationResult,
            paymentId: this.paymentId,
            webhookDelivered: this.webhookDelivered,
            notificationSent: this.notificationSent,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Computed properties
            isCompleted: this.isCompleted,
            canRetry: this.canRetry,
            isPending: this.isPending,
            processingDuration: this.processingDuration,
            confirmations: this.confirmations,
            requiredConfirmations: this.requiredConfirmations,
            hasMinConfirmations: this.hasMinConfirmations,
            isHighPriority: this.isHighPriority,
            metadata: {
                ...this.metadata,
                processingStepsCount: this.processingSteps.length,
                retryHistoryCount: this.retryHistory.length,
            },
        };
    }
    // Minimal JSON for public tracking
    toPublicJSON() {
        return {
            id: this.id,
            status: this.status,
            txHash: this.txHash,
            confirmations: this.confirmations,
            requiredConfirmations: this.requiredConfirmations,
            hasMinConfirmations: this.hasMinConfirmations,
            retryCount: this.retryCount,
            createdAt: this.createdAt,
            completedAt: this.completedAt,
            verificationResult: this.verificationResult ? {
                isValid: this.verificationResult.isValid,
                reason: this.verificationResult.reason,
            } : undefined,
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.PaymentVerificationJob = PaymentVerificationJob;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chain_id', type: 'integer', nullable: false }),
    __metadata("design:type", Number)
], PaymentVerificationJob.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "tokenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tx_hash', type: 'varchar', length: 66, nullable: false }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "txHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'from_address', type: 'varchar', length: 42, nullable: true }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "fromAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_amount', type: 'decimal', precision: 36, scale: 18, nullable: false }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "expectedAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_recipient', type: 'varchar', length: 42, nullable: false }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "expectedRecipient", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, default: 'normal' }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retry_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PaymentVerificationJob.prototype, "retryCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_retries', type: 'integer', default: 10 }),
    __metadata("design:type", Number)
], PaymentVerificationJob.prototype, "maxRetries", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_retry_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], PaymentVerificationJob.prototype, "nextRetryAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], PaymentVerificationJob.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'completed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], PaymentVerificationJob.prototype, "completedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_code', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "errorCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verification_data', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], PaymentVerificationJob.prototype, "verificationData", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verification_result', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], PaymentVerificationJob.prototype, "verificationResult", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'payment_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], PaymentVerificationJob.prototype, "paymentId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'webhook_delivered', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PaymentVerificationJob.prototype, "webhookDelivered", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'notification_sent', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PaymentVerificationJob.prototype, "notificationSent", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], PaymentVerificationJob.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PaymentVerificationJob.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PaymentVerificationJob.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Invoice_1.Invoice, invoice => invoice.verificationJobs, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'invoice_id' }),
    __metadata("design:type", Invoice_1.Invoice)
], PaymentVerificationJob.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BlockchainNetwork_1.BlockchainNetwork, { nullable: false }),
    (0, typeorm_1.JoinColumn)({ name: 'chain_id' }),
    __metadata("design:type", BlockchainNetwork_1.BlockchainNetwork)
], PaymentVerificationJob.prototype, "network", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Token_1.Token, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'token_id' }),
    __metadata("design:type", Token_1.Token)
], PaymentVerificationJob.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Payment_1.Payment, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'payment_id' }),
    __metadata("design:type", Payment_1.Payment)
], PaymentVerificationJob.prototype, "payment", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaymentVerificationJob.prototype, "generateId", null);
exports.PaymentVerificationJob = PaymentVerificationJob = __decorate([
    (0, typeorm_1.Entity)('payment_verification_jobs'),
    (0, typeorm_1.Index)(['invoiceId']),
    (0, typeorm_1.Index)(['chainId']),
    (0, typeorm_1.Index)(['txHash']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['priority']),
    (0, typeorm_1.Index)(['nextRetryAt']),
    (0, typeorm_1.Index)(['status', 'nextRetryAt']),
    (0, typeorm_1.Index)(['priority', 'createdAt']),
    (0, typeorm_1.Check)('retry_count_positive', 'retry_count >= 0'),
    (0, typeorm_1.Check)('retry_count_max', 'retry_count <= 20'),
    (0, typeorm_1.Check)('tx_hash_format', "tx_hash ~* '^0x[a-fA-F0-9]{64}$'")
], PaymentVerificationJob);
//# sourceMappingURL=PaymentVerificationJob.js.map