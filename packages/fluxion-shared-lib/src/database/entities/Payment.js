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
exports.Payment = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const Invoice_1 = require("./Invoice");
const BlockchainNetwork_1 = require("./BlockchainNetwork");
const Token_1 = require("./Token");
let Payment = class Payment {
    // Computed properties
    get displayAmount() {
        return this.token?.formatAmountWithSymbol(this.amount) || this.amount;
    }
    get shortTxHash() {
        return `${this.txHash.slice(0, 8)}...${this.txHash.slice(-6)}`;
    }
    get shortFromAddress() {
        return `${this.fromAddress.slice(0, 6)}...${this.fromAddress.slice(-4)}`;
    }
    get shortToAddress() {
        return `${this.toAddress.slice(0, 6)}...${this.toAddress.slice(-4)}`;
    }
    get isConfirmed() {
        return this.status === 'confirmed';
    }
    get isPending() {
        return this.status === 'pending';
    }
    get isFailed() {
        return this.status === 'failed';
    }
    get explorerUrl() {
        return this.network?.getTransactionUrl(this.txHash) || null;
    }
    get fromAddressUrl() {
        return this.network?.getAddressUrl(this.fromAddress) || null;
    }
    get toAddressUrl() {
        return this.network?.getAddressUrl(this.toAddress) || null;
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
        // Format gas cost in network native token
        const amount = Number(totalCost) / Math.pow(10, 18); // Assuming 18 decimals for gas
        return `${amount.toFixed(6)} ${this.network?.symbol || 'ETH'}`;
    }
    get confirmationProgress() {
        const maxConfirmations = 12; // Most networks consider 12 confirmations as final
        return Math.min((this.confirmations / maxConfirmations) * 100, 100);
    }
    get age() {
        return Date.now() - this.createdAt.getTime();
    }
    get ageInMinutes() {
        return Math.floor(this.age / (1000 * 60));
    }
    // Methods
    toJSON() {
        return {
            ...this,
            displayAmount: this.displayAmount,
            shortTxHash: this.shortTxHash,
            shortFromAddress: this.shortFromAddress,
            shortToAddress: this.shortToAddress,
            isConfirmed: this.isConfirmed,
            isPending: this.isPending,
            isFailed: this.isFailed,
            explorerUrl: this.explorerUrl,
            fromAddressUrl: this.fromAddressUrl,
            toAddressUrl: this.toAddressUrl,
            totalGasCost: this.totalGasCost,
            displayGasCost: this.displayGasCost,
            confirmationProgress: this.confirmationProgress,
            age: this.age,
            ageInMinutes: this.ageInMinutes,
        };
    }
    updateConfirmations(blockNumber, currentBlockNumber) {
        this.blockNumber = blockNumber;
        this.confirmations = Math.max(0, parseInt(currentBlockNumber) - parseInt(blockNumber));
        if (this.confirmations >= 1 && this.status === 'pending') {
            this.status = 'confirmed';
            this.confirmedAt = new Date();
        }
    }
    markAsConfirmed(blockNumber, gasUsed) {
        this.status = 'confirmed';
        this.blockNumber = blockNumber;
        this.confirmations = 1;
        this.confirmedAt = new Date();
        if (gasUsed) {
            this.gasUsed = gasUsed;
        }
    }
    markAsFailed(reason) {
        this.status = 'failed';
        if (reason) {
            this.metadata = { ...this.metadata, errorReason: reason };
        }
    }
    addMetadata(key, value) {
        this.metadata = { ...this.metadata, [key]: value };
    }
    // Static methods
    static validateTxHash(hash) {
        return /^0x[a-fA-F0-9]{64}$/.test(hash);
    }
    static validateAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    static validateAmount(amount) {
        const num = parseFloat(amount);
        return !isNaN(num) && num > 0;
    }
    static validateStatus(status) {
        return ['pending', 'confirmed', 'failed'].includes(status);
    }
    static validateBlockNumber(blockNumber) {
        const num = parseInt(blockNumber);
        return !isNaN(num) && num >= 0;
    }
    static fromBlockchainTransaction(transaction, organizationId, chainId, tokenId, invoiceId) {
        return {
            organizationId,
            invoiceId,
            txHash: transaction.hash,
            chainId,
            tokenId,
            fromAddress: transaction.from,
            toAddress: transaction.to,
            amount: transaction.value,
            gasUsed: transaction.gasUsed,
            gasPrice: transaction.gasPrice,
            blockNumber: transaction.blockNumber,
            status: transaction.blockNumber ? 'confirmed' : 'pending',
            confirmations: transaction.blockNumber ? 1 : 0,
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.Payment = Payment;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Payment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], Payment.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tx_hash', type: 'varchar', length: 66, nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "txHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chain_id', type: 'integer', nullable: false }),
    __metadata("design:type", Number)
], Payment.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "tokenId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'from_address', type: 'varchar', length: 42, nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "fromAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'to_address', type: 'varchar', length: 42, nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "toAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 36, scale: 18, nullable: false }),
    __metadata("design:type", String)
], Payment.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_used', type: 'bigint', nullable: true }),
    __metadata("design:type", String)
], Payment.prototype, "gasUsed", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_price', type: 'decimal', precision: 36, scale: 18, nullable: true }),
    __metadata("design:type", String)
], Payment.prototype, "gasPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        length: 20,
        default: 'pending',
        nullable: false,
    }),
    __metadata("design:type", String)
], Payment.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'block_number', type: 'bigint', nullable: true }),
    __metadata("design:type", String)
], Payment.prototype, "blockNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Payment.prototype, "confirmations", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], Payment.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Payment.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Payment.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'confirmed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Payment.prototype, "confirmedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.payments, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], Payment.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Invoice_1.Invoice, invoice => invoice.payments, {
        nullable: true,
        onDelete: 'SET NULL',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'invoice_id' }),
    __metadata("design:type", Invoice_1.Invoice)
], Payment.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BlockchainNetwork_1.BlockchainNetwork, network => network.payments, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'chain_id' }),
    __metadata("design:type", BlockchainNetwork_1.BlockchainNetwork)
], Payment.prototype, "network", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Token_1.Token, token => token.payments, {
        nullable: false,
    }),
    (0, typeorm_1.JoinColumn)({ name: 'token_id' }),
    __metadata("design:type", Token_1.Token)
], Payment.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Payment.prototype, "generateId", null);
exports.Payment = Payment = __decorate([
    (0, typeorm_1.Entity)('payments'),
    (0, typeorm_1.Index)(['txHash', 'chainId'], { unique: true }),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['invoiceId']),
    (0, typeorm_1.Index)(['chainId']),
    (0, typeorm_1.Index)(['tokenId']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['fromAddress']),
    (0, typeorm_1.Index)(['toAddress']),
    (0, typeorm_1.Index)(['blockNumber']),
    (0, typeorm_1.Check)('amount_positive', 'amount > 0'),
    (0, typeorm_1.Check)('status_valid', "status IN ('pending', 'confirmed', 'failed')")
], Payment);
//# sourceMappingURL=Payment.js.map