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
var PayrollRecipient_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollRecipient = void 0;
const typeorm_1 = require("typeorm");
const PayrollBatch_1 = require("./PayrollBatch");
let PayrollRecipient = PayrollRecipient_1 = class PayrollRecipient {
    // Computed properties
    get displayAmount() {
        return this.batch?.token?.formatAmountWithSymbol(this.amount) || this.amount;
    }
    get shortWalletAddress() {
        return `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`;
    }
    get shortTxHash() {
        return this.txHash ? `${this.txHash.slice(0, 8)}...${this.txHash.slice(-6)}` : null;
    }
    get isPending() {
        return this.status === 'pending';
    }
    get isSent() {
        return this.status === 'sent';
    }
    get isFailed() {
        return this.status === 'failed';
    }
    get displayName() {
        if (this.employeeId) {
            return `${this.name} (${this.employeeId})`;
        }
        return this.name;
    }
    get walletAddressUrl() {
        return this.batch?.network?.getAddressUrl(this.walletAddress) || null;
    }
    get explorerUrl() {
        return this.txHash && this.batch?.network
            ? this.batch.network.getTransactionUrl(this.txHash)
            : null;
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
        return `${amount.toFixed(6)} ${this.batch?.network?.symbol || 'ETH'}`;
    }
    get departmentAndPosition() {
        const parts = [this.department, this.position].filter(Boolean);
        return parts.length > 0 ? parts.join(' - ') : null;
    }
    // Methods
    toJSON() {
        return {
            ...this,
            displayAmount: this.displayAmount,
            shortWalletAddress: this.shortWalletAddress,
            shortTxHash: this.shortTxHash,
            isPending: this.isPending,
            isSent: this.isSent,
            isFailed: this.isFailed,
            displayName: this.displayName,
            walletAddressUrl: this.walletAddressUrl,
            explorerUrl: this.explorerUrl,
            totalGasCost: this.totalGasCost,
            displayGasCost: this.displayGasCost,
            departmentAndPosition: this.departmentAndPosition,
        };
    }
    markAsSent(txHash, gasUsed, gasPrice) {
        this.status = 'sent';
        this.txHash = txHash;
        this.gasUsed = gasUsed;
        this.gasPrice = gasPrice;
        this.sentAt = new Date();
    }
    markAsFailed(errorMessage) {
        this.status = 'failed';
        this.errorMessage = errorMessage;
    }
    retry() {
        if (this.status === 'failed') {
            this.status = 'pending';
            this.errorMessage = undefined;
            this.txHash = undefined;
            this.gasUsed = undefined;
            this.gasPrice = undefined;
            this.sentAt = undefined;
        }
    }
    updateMetadata(key, value) {
        this.metadata = { ...this.metadata, [key]: value };
    }
    calculateUsdValue(exchangeRate) {
        const amountNum = parseFloat(this.amount);
        const rateNum = parseFloat(exchangeRate);
        if (!isNaN(amountNum) && !isNaN(rateNum)) {
            const usdValue = (amountNum * rateNum).toFixed(2);
            this.updateMetadata('usdValue', usdValue);
            this.updateMetadata('exchangeRate', exchangeRate);
        }
    }
    // Static methods
    static validateWalletAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    static validateAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num > 0;
    }
    static validateStatus(status) {
        return ['pending', 'sent', 'failed'].includes(status);
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    static fromCsvRow(row) {
        return {
            name: row.name,
            walletAddress: row.walletAddress,
            amount: row.amount,
            email: row.email,
            employeeId: row.employeeId,
            department: row.department,
            position: row.position,
            status: 'pending',
        };
    }
    static validateCsvRow(row) {
        const errors = [];
        if (!row.name || typeof row.name !== 'string') {
            errors.push('Name is required');
        }
        if (!row.walletAddress || !PayrollRecipient_1.validateWalletAddress(row.walletAddress)) {
            errors.push('Valid wallet address is required');
        }
        if (!row.amount || !PayrollRecipient_1.validateAmount(row.amount)) {
            errors.push('Valid amount is required');
        }
        if (row.email && !PayrollRecipient_1.validateEmail(row.email)) {
            errors.push('Invalid email format');
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
};
exports.PayrollRecipient = PayrollRecipient;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'batch_id', type: 'uuid', nullable: false }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "batchId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wallet_address', type: 'varchar', length: 42, nullable: false }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "walletAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 36, scale: 18, nullable: false }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 320, nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'employee_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "employeeId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "department", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'pending',
        nullable: false,
    }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tx_hash', type: 'varchar', length: 66, nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "txHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_used', type: 'bigint', nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "gasUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_price', type: 'decimal', precision: 36, scale: 18, nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "gasPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'error_message', type: 'text', nullable: true }),
    __metadata("design:type", String)
], PayrollRecipient.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], PayrollRecipient.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], PayrollRecipient.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PayrollRecipient.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PayrollRecipient.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => PayrollBatch_1.PayrollBatch, batch => batch.recipients, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'batch_id' }),
    __metadata("design:type", PayrollBatch_1.PayrollBatch)
], PayrollRecipient.prototype, "batch", void 0);
exports.PayrollRecipient = PayrollRecipient = PayrollRecipient_1 = __decorate([
    (0, typeorm_1.Entity)('payroll_recipients'),
    (0, typeorm_1.Index)(['batchId']),
    (0, typeorm_1.Index)(['walletAddress']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Check)('amount_positive', 'amount > 0'),
    (0, typeorm_1.Check)('wallet_format', "wallet_address ~* '^0x[a-fA-F0-9]{40}$'"),
    (0, typeorm_1.Check)('status_valid', "status IN ('pending', 'sent', 'failed')")
], PayrollRecipient);
//# sourceMappingURL=PayrollRecipient.js.map