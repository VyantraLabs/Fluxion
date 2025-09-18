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
exports.PayrollBatch = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
const BlockchainNetwork_1 = require("./BlockchainNetwork");
const Token_1 = require("./Token");
const PayrollRecipient_1 = require("./PayrollRecipient");
let PayrollBatch = class PayrollBatch {
    // Computed properties
    get displayTotalAmount() {
        return this.token?.formatAmountWithSymbol(this.totalAmount) || this.totalAmount;
    }
    get shortTxHash() {
        return this.txHash ? `${this.txHash.slice(0, 8)}...${this.txHash.slice(-6)}` : null;
    }
    get successRate() {
        return this.recipientsCount > 0 ? (this.successfulCount / this.recipientsCount) * 100 : 0;
    }
    get isCompleted() {
        return this.status === 'completed';
    }
    get isProcessing() {
        return this.status === 'processing';
    }
    get isDraft() {
        return this.status === 'draft';
    }
    get isFailed() {
        return this.status === 'failed';
    }
    get isPartiallyCompleted() {
        return this.status === 'partially_completed';
    }
    get canEdit() {
        return this.status === 'draft';
    }
    get canExecute() {
        return this.status === 'draft' && this.recipientsCount > 0;
    }
    get canRetry() {
        return this.status === 'failed' || this.status === 'partially_completed';
    }
    get explorerUrl() {
        return this.txHash && this.network ? this.network.getTransactionUrl(this.txHash) : null;
    }
    get totalGasCost() {
        if (!this.gasUsed || !this.gasPrice)
            return null;
        const gasCost = BigInt(this.gasUsed) * BigInt(this.gasPrice);
        return gasCost.toString();
    }
    get displayGasCost() {
        const totalCost = this.totalGasCost;
        if (!totalCost)
            return null;
        const amount = Number(totalCost) / Math.pow(10, 18);
        return `${amount.toFixed(6)} ${this.network?.symbol || 'ETH'}`;
    }
    get averageAmountPerRecipient() {
        if (this.recipientsCount === 0)
            return '0';
        return (parseFloat(this.totalAmount) / this.recipientsCount).toString();
    }
    get displayAverageAmount() {
        return this.token?.formatAmountWithSymbol(this.averageAmountPerRecipient) || this.averageAmountPerRecipient;
    }
    // Methods
    toJSON() {
        return {
            ...this,
            displayTotalAmount: this.displayTotalAmount,
            shortTxHash: this.shortTxHash,
            successRate: this.successRate,
            isCompleted: this.isCompleted,
            isProcessing: this.isProcessing,
            isDraft: this.isDraft,
            isFailed: this.isFailed,
            isPartiallyCompleted: this.isPartiallyCompleted,
            canEdit: this.canEdit,
            canExecute: this.canExecute,
            canRetry: this.canRetry,
            explorerUrl: this.explorerUrl,
            totalGasCost: this.totalGasCost,
            displayGasCost: this.displayGasCost,
            averageAmountPerRecipient: this.averageAmountPerRecipient,
            displayAverageAmount: this.displayAverageAmount,
        };
    }
    calculateTotals() {
        if (this.recipients && this.recipients.length > 0) {
            this.recipientsCount = this.recipients.length;
            this.totalAmount = this.recipients
                .reduce((sum, recipient) => sum + parseFloat(recipient.amount), 0)
                .toString();
            this.successfulCount = this.recipients.filter(r => r.status === 'sent').length;
            this.failedCount = this.recipients.filter(r => r.status === 'failed').length;
        }
    }
    startProcessing() {
        if (this.status === 'draft') {
            this.status = 'processing';
        }
    }
    markAsCompleted(txHash, blockNumber, gasUsed, gasPrice) {
        this.status = 'completed';
        this.txHash = txHash;
        this.blockNumber = blockNumber;
        this.gasUsed = gasUsed;
        this.gasPrice = gasPrice;
        this.executedAt = new Date();
    }
    markAsPartiallyCompleted(txHash) {
        this.status = 'partially_completed';
        if (txHash) {
            this.txHash = txHash;
        }
        this.executedAt = new Date();
    }
    markAsFailed(error) {
        this.status = 'failed';
        this.executedAt = new Date();
        if (error) {
            this.metadata = {
                ...this.metadata,
                errorDetails: [...(this.metadata.errorDetails || []), error],
            };
        }
    }
    incrementRetryCount() {
        this.metadata = {
            ...this.metadata,
            retryCount: (this.metadata.retryCount || 0) + 1,
        };
    }
    addRecipient(_recipient) {
        if (!this.canEdit) {
            throw new Error('Cannot add recipients to a batch that is not in draft status');
        }
        // This would be handled by the service layer in practice
        // The recipients relationship would be updated through TypeORM
    }
    removeRecipient(_recipientId) {
        if (!this.canEdit) {
            throw new Error('Cannot remove recipients from a batch that is not in draft status');
        }
        // This would be handled by the service layer in practice
    }
    // Static methods
    static validateStatus(status) {
        return ['draft', 'processing', 'completed', 'failed', 'partially_completed'].includes(status);
    }
    static validateAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num >= 0;
    }
    static generateBatchTitle(type, period) {
        const timestamp = new Date().toISOString().slice(0, 10);
        const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
        if (period) {
            return `${formattedType} - ${period}`;
        }
        return `${formattedType} - ${timestamp}`;
    }
};
exports.PayrollBatch = PayrollBatch;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PayrollBatch.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chain_id', type: 'integer', nullable: false }),
    __metadata("design:type", Number)
], PayrollBatch.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_id', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "tokenId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'draft',
        nullable: false,
    }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_amount', type: 'decimal', precision: 36, scale: 18, default: '0' }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "totalAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'recipients_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PayrollBatch.prototype, "recipientsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'successful_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PayrollBatch.prototype, "successfulCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failed_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], PayrollBatch.prototype, "failedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tx_hash', type: 'varchar', length: 66, nullable: true }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "txHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_used', type: 'bigint', nullable: true }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "gasUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_price', type: 'decimal', precision: 36, scale: 18, nullable: true }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "gasPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'block_number', type: 'bigint', nullable: true }),
    __metadata("design:type", String)
], PayrollBatch.prototype, "blockNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], PayrollBatch.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'executed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], PayrollBatch.prototype, "executedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PayrollBatch.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PayrollBatch.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.payrollBatches, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], PayrollBatch.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.payrollBatches, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'created_by' }),
    __metadata("design:type", User_1.User)
], PayrollBatch.prototype, "createdByUser", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BlockchainNetwork_1.BlockchainNetwork, network => network.payrollBatches, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'chain_id' }),
    __metadata("design:type", BlockchainNetwork_1.BlockchainNetwork)
], PayrollBatch.prototype, "network", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Token_1.Token, token => token.payrollBatches, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'token_id' }),
    __metadata("design:type", Token_1.Token)
], PayrollBatch.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PayrollRecipient_1.PayrollRecipient, recipient => recipient.batch, { cascade: true }),
    __metadata("design:type", Array)
], PayrollBatch.prototype, "recipients", void 0);
exports.PayrollBatch = PayrollBatch = __decorate([
    (0, typeorm_1.Entity)('payroll_batches'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['createdBy']),
    (0, typeorm_1.Index)(['chainId']),
    (0, typeorm_1.Index)(['tokenId']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['executedAt']),
    (0, typeorm_1.Check)('status_valid', "status IN ('draft', 'processing', 'completed', 'failed', 'partially_completed')")
], PayrollBatch);
//# sourceMappingURL=PayrollBatch.js.map