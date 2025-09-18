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
exports.Token = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const BlockchainNetwork_1 = require("./BlockchainNetwork");
const Invoice_1 = require("./Invoice");
const Payment_1 = require("./Payment");
const PayrollBatch_1 = require("./PayrollBatch");
let Token = class Token {
    // Computed properties
    get displayName() {
        return `${this.name} (${this.symbol})`;
    }
    get isERC20() {
        return !this.isNative && !!this.contractAddress;
    }
    get tokenType() {
        return this.isNative ? 'native' : 'erc20';
    }
    get decimalsForDisplay() {
        // For display purposes, limit decimal places based on token type
        if (this.isStablecoin)
            return 2;
        if (this.isNative)
            return 4;
        return Math.min(this.decimals, 6);
    }
    // Methods
    toJSON() {
        return {
            ...this,
            displayName: this.displayName,
            isERC20: this.isERC20,
            tokenType: this.tokenType,
            decimalsForDisplay: this.decimalsForDisplay,
        };
    }
    formatAmount(amount, maxDecimals) {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const displayDecimals = maxDecimals ?? this.decimalsForDisplay;
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: displayDecimals,
        }).format(numAmount);
    }
    formatAmountWithSymbol(amount, maxDecimals) {
        return `${this.formatAmount(amount, maxDecimals)} ${this.symbol}`;
    }
    // Parse amount from human-readable string to wei/smallest unit
    parseAmount(amount) {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 0) {
            throw new Error(`Invalid amount: ${amount}`);
        }
        // Convert to wei (multiply by 10^decimals)
        const wei = BigInt(Math.floor(numAmount * Math.pow(10, this.decimals)));
        return wei.toString();
    }
    // Format amount from wei/smallest unit to human-readable string
    formatFromWei(weiAmount) {
        const wei = BigInt(weiAmount);
        const divisor = BigInt(Math.pow(10, this.decimals));
        const amount = Number(wei) / Number(divisor);
        return this.formatAmount(amount);
    }
    // Static methods for common tokens
    static getCommonTokens() {
        return [
            // Ethereum tokens
            {
                symbol: 'ETH',
                name: 'Ethereum',
                decimals: 18,
                isNative: true,
                isStablecoin: false,
                contractAddress: undefined,
            },
            {
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                isNative: false,
                isStablecoin: true,
                contractAddress: '0xA0b86a33E6441E2E65d8b9B65Ed8da8E0b9e5eaa', // Ethereum USDC
            },
            {
                symbol: 'USDT',
                name: 'Tether USD',
                decimals: 6,
                isNative: false,
                isStablecoin: true,
                contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Ethereum USDT
            },
            // Polygon tokens
            {
                symbol: 'MATIC',
                name: 'Polygon',
                decimals: 18,
                isNative: true,
                isStablecoin: false,
                contractAddress: undefined,
            },
            {
                symbol: 'USDC',
                name: 'USD Coin (Polygon)',
                decimals: 6,
                isNative: false,
                isStablecoin: true,
                contractAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // Polygon USDC
            },
        ];
    }
    static validateContractAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    static validateSymbol(symbol) {
        return /^[A-Z][A-Z0-9]{0,19}$/.test(symbol);
    }
    static validateDecimals(decimals) {
        return Number.isInteger(decimals) && decimals >= 0 && decimals <= 77;
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.Token = Token;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Token.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chain_id', type: 'integer', nullable: false }),
    __metadata("design:type", Number)
], Token.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contract_address', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], Token.prototype, "contractAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: false }),
    __metadata("design:type", String)
], Token.prototype, "symbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], Token.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 18, nullable: false }),
    __metadata("design:type", Number)
], Token.prototype, "decimals", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_native', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Token.prototype, "isNative", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_stablecoin', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Token.prototype, "isStablecoin", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'logo_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Token.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'price_feed_id', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", String)
], Token.prototype, "priceFeedId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Token.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Token.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Token.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BlockchainNetwork_1.BlockchainNetwork, network => network.tokens, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'chain_id' }),
    __metadata("design:type", BlockchainNetwork_1.BlockchainNetwork)
], Token.prototype, "network", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, invoice => invoice.token),
    __metadata("design:type", Array)
], Token.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payment, payment => payment.token),
    __metadata("design:type", Array)
], Token.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PayrollBatch_1.PayrollBatch, batch => batch.token),
    __metadata("design:type", Array)
], Token.prototype, "payrollBatches", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Token.prototype, "generateId", null);
exports.Token = Token = __decorate([
    (0, typeorm_1.Entity)('tokens'),
    (0, typeorm_1.Index)(['contractAddress', 'chainId'], { unique: true }),
    (0, typeorm_1.Index)(['chainId']),
    (0, typeorm_1.Index)(['symbol']),
    (0, typeorm_1.Index)(['isActive']),
    (0, typeorm_1.Check)('native_address_check', '(is_native = true AND contract_address IS NULL) OR (is_native = false AND contract_address IS NOT NULL)')
], Token);
//# sourceMappingURL=Token.js.map