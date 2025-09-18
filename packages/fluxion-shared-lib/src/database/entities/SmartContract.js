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
exports.SmartContract = void 0;
const typeorm_1 = require("typeorm");
const BlockchainNetwork_1 = require("./BlockchainNetwork");
let SmartContract = class SmartContract {
    // Computed properties
    get displayName() {
        return `${this.contractType.charAt(0).toUpperCase() + this.contractType.slice(1)} Contract`;
    }
    get shortAddress() {
        return `${this.contractAddress.slice(0, 6)}...${this.contractAddress.slice(-4)}`;
    }
    get isDeployed() {
        return !!this.deployedAt;
    }
    get age() {
        if (!this.deployedAt)
            return null;
        return Date.now() - this.deployedAt.getTime();
    }
    // Methods
    toJSON() {
        return {
            ...this,
            displayName: this.displayName,
            shortAddress: this.shortAddress,
            isDeployed: this.isDeployed,
            age: this.age,
        };
    }
    getFunctionSelector(functionName) {
        const functionAbi = this.abi.find((item) => item.type === 'function' && item.name === functionName);
        if (!functionAbi)
            return null;
        // Create function signature
        const inputs = functionAbi.inputs?.map((input) => input.type).join(',') || '';
        const signature = `${functionName}(${inputs})`;
        // Calculate keccak256 hash (first 4 bytes)
        // Note: In production, you'd use a proper keccak256 implementation
        return signature; // Simplified for this example
    }
    getFunction(functionName) {
        return this.abi.find((item) => item.type === 'function' && item.name === functionName) || null;
    }
    getEvent(eventName) {
        return this.abi.find((item) => item.type === 'event' && item.name === eventName) || null;
    }
    getFunctions() {
        return this.abi.filter((item) => item.type === 'function');
    }
    getEvents() {
        return this.abi.filter((item) => item.type === 'event');
    }
    // Static methods for common contract types
    static getPaymentContractABI() {
        return [
            {
                type: 'function',
                name: 'pay',
                inputs: [
                    { name: 'recipient', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'token', type: 'address' },
                ],
                outputs: [],
                stateMutability: 'payable',
            },
            {
                type: 'function',
                name: 'batchPay',
                inputs: [
                    { name: 'recipients', type: 'address[]' },
                    { name: 'amounts', type: 'uint256[]' },
                    { name: 'token', type: 'address' },
                ],
                outputs: [],
                stateMutability: 'payable',
            },
            {
                type: 'event',
                name: 'Payment',
                inputs: [
                    { name: 'from', type: 'address', indexed: true },
                    { name: 'to', type: 'address', indexed: true },
                    { name: 'amount', type: 'uint256', indexed: false },
                    { name: 'token', type: 'address', indexed: true },
                ],
            },
        ];
    }
    static getEscrowContractABI() {
        return [
            {
                type: 'function',
                name: 'createEscrow',
                inputs: [
                    { name: 'recipient', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                    { name: 'token', type: 'address' },
                    { name: 'releaseTime', type: 'uint256' },
                ],
                outputs: [{ name: 'escrowId', type: 'uint256' }],
                stateMutability: 'payable',
            },
            {
                type: 'function',
                name: 'releaseEscrow',
                inputs: [{ name: 'escrowId', type: 'uint256' }],
                outputs: [],
                stateMutability: 'nonpayable',
            },
            {
                type: 'event',
                name: 'EscrowCreated',
                inputs: [
                    { name: 'escrowId', type: 'uint256', indexed: true },
                    { name: 'sender', type: 'address', indexed: true },
                    { name: 'recipient', type: 'address', indexed: true },
                    { name: 'amount', type: 'uint256', indexed: false },
                ],
            },
        ];
    }
    static validateContractAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    static validateContractType(type) {
        return ['payment', 'escrow', 'subscription', 'payroll', 'multisig'].includes(type);
    }
    static validateABI(abi) {
        if (!Array.isArray(abi))
            return false;
        return abi.every((item) => {
            return (item &&
                typeof item === 'object' &&
                ['function', 'event', 'constructor', 'fallback', 'receive'].includes(item.type));
        });
    }
};
exports.SmartContract = SmartContract;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], SmartContract.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chain_id', type: 'integer', nullable: false }),
    __metadata("design:type", Number)
], SmartContract.prototype, "chainId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contract_address', type: 'varchar', length: 42, nullable: false }),
    __metadata("design:type", String)
], SmartContract.prototype, "contractAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({
        name: 'contract_type',
        type: 'varchar',
        length: 50,
        nullable: false,
    }),
    __metadata("design:type", String)
], SmartContract.prototype, "contractType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: false }),
    __metadata("design:type", Array)
], SmartContract.prototype, "abi", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: '1.0.0' }),
    __metadata("design:type", String)
], SmartContract.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], SmartContract.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deployed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], SmartContract.prototype, "deployedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], SmartContract.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], SmartContract.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => BlockchainNetwork_1.BlockchainNetwork, network => network.smartContracts, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'chain_id' }),
    __metadata("design:type", BlockchainNetwork_1.BlockchainNetwork)
], SmartContract.prototype, "network", void 0);
exports.SmartContract = SmartContract = __decorate([
    (0, typeorm_1.Entity)('smart_contracts'),
    (0, typeorm_1.Index)(['contractAddress', 'chainId'], { unique: true }),
    (0, typeorm_1.Index)(['chainId']),
    (0, typeorm_1.Index)(['contractType']),
    (0, typeorm_1.Index)(['isActive'])
], SmartContract);
//# sourceMappingURL=SmartContract.js.map