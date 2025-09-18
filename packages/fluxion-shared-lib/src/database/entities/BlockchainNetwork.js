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
exports.BlockchainNetwork = void 0;
const typeorm_1 = require("typeorm");
const Token_1 = require("./Token");
const SmartContract_1 = require("./SmartContract");
const Invoice_1 = require("./Invoice");
const Payment_1 = require("./Payment");
const PayrollBatch_1 = require("./PayrollBatch");
let BlockchainNetwork = class BlockchainNetwork {
    // Computed properties
    get networkType() {
        return this.isTestnet ? 'testnet' : 'mainnet';
    }
    get explorerTxUrl() {
        if (!this.explorerUrl)
            return null;
        return `${this.explorerUrl}/tx/`;
    }
    get explorerAddressUrl() {
        if (!this.explorerUrl)
            return null;
        return `${this.explorerUrl}/address/`;
    }
    get hasEIP1559Support() {
        return this.gasSettings.type === 'eip1559';
    }
    // Methods
    toJSON() {
        return {
            ...this,
            networkType: this.networkType,
            explorerTxUrl: this.explorerTxUrl,
            explorerAddressUrl: this.explorerAddressUrl,
            hasEIP1559Support: this.hasEIP1559Support,
        };
    }
    getTransactionUrl(txHash) {
        const baseUrl = this.explorerTxUrl;
        return baseUrl ? `${baseUrl}${txHash}` : null;
    }
    getAddressUrl(address) {
        const baseUrl = this.explorerAddressUrl;
        return baseUrl ? `${baseUrl}${address}` : null;
    }
    // Static methods for common networks
    static getMainnetNetworks() {
        return [
            {
                chainId: 1,
                name: 'Ethereum',
                symbol: 'ETH',
                rpcUrl: 'https://mainnet.infura.io/v3/',
                explorerUrl: 'https://etherscan.io',
                isTestnet: false,
                gasSettings: { type: 'eip1559' },
            },
            {
                chainId: 137,
                name: 'Polygon',
                symbol: 'MATIC',
                rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/',
                explorerUrl: 'https://polygonscan.com',
                isTestnet: false,
                gasSettings: { type: 'eip1559' },
            },
            {
                chainId: 42161,
                name: 'Arbitrum One',
                symbol: 'ETH',
                rpcUrl: 'https://arb1.arbitrum.io/rpc',
                explorerUrl: 'https://arbiscan.io',
                isTestnet: false,
                gasSettings: { type: 'eip1559' },
            },
            {
                chainId: 10,
                name: 'Optimism',
                symbol: 'ETH',
                rpcUrl: 'https://mainnet.optimism.io',
                explorerUrl: 'https://optimistic.etherscan.io',
                isTestnet: false,
                gasSettings: { type: 'eip1559' },
            },
        ];
    }
    static getTestnetNetworks() {
        return [
            {
                chainId: 11155111,
                name: 'Sepolia',
                symbol: 'SepoliaETH',
                rpcUrl: 'https://sepolia.infura.io/v3/',
                explorerUrl: 'https://sepolia.etherscan.io',
                isTestnet: true,
                gasSettings: { type: 'eip1559' },
            },
            {
                chainId: 80001,
                name: 'Mumbai',
                symbol: 'MATIC',
                rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/',
                explorerUrl: 'https://mumbai.polygonscan.com',
                isTestnet: true,
                gasSettings: { type: 'eip1559' },
            },
        ];
    }
    static validateChainId(chainId) {
        return Number.isInteger(chainId) && chainId > 0;
    }
    static validateRpcUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:';
        }
        catch {
            return false;
        }
    }
};
exports.BlockchainNetwork = BlockchainNetwork;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'chain_id', type: 'integer' }),
    __metadata("design:type", Number)
], BlockchainNetwork.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], BlockchainNetwork.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10, nullable: false }),
    __metadata("design:type", String)
], BlockchainNetwork.prototype, "symbol", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'rpc_url', type: 'varchar', length: 500, nullable: false }),
    __metadata("design:type", String)
], BlockchainNetwork.prototype, "rpcUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'explorer_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], BlockchainNetwork.prototype, "explorerUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_testnet', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], BlockchainNetwork.prototype, "isTestnet", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], BlockchainNetwork.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gas_settings', type: 'jsonb', default: {} }),
    __metadata("design:type", Object)
], BlockchainNetwork.prototype, "gasSettings", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], BlockchainNetwork.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], BlockchainNetwork.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Token_1.Token, token => token.network, { cascade: true }),
    __metadata("design:type", Array)
], BlockchainNetwork.prototype, "tokens", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SmartContract_1.SmartContract, contract => contract.network, { cascade: true }),
    __metadata("design:type", Array)
], BlockchainNetwork.prototype, "smartContracts", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Invoice_1.Invoice, invoice => invoice.network),
    __metadata("design:type", Array)
], BlockchainNetwork.prototype, "invoices", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payment_1.Payment, payment => payment.network),
    __metadata("design:type", Array)
], BlockchainNetwork.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => PayrollBatch_1.PayrollBatch, batch => batch.network),
    __metadata("design:type", Array)
], BlockchainNetwork.prototype, "payrollBatches", void 0);
exports.BlockchainNetwork = BlockchainNetwork = __decorate([
    (0, typeorm_1.Entity)('blockchain_networks'),
    (0, typeorm_1.Index)(['isActive'])
], BlockchainNetwork);
//# sourceMappingURL=BlockchainNetwork.js.map