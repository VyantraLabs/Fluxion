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
exports.InvoiceAccessToken = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Invoice_1 = require("./Invoice");
let InvoiceAccessToken = class InvoiceAccessToken {
    // Computed properties
    get isExpired() {
        return new Date() > this.expiresAt;
    }
    get isValid() {
        return this.isActive &&
            !this.isExpired &&
            this.accessCount < this.maxAccessCount;
    }
    get remainingAccesses() {
        return Math.max(0, this.maxAccessCount - this.accessCount);
    }
    get daysUntilExpiry() {
        const now = new Date();
        const timeDiff = this.expiresAt.getTime() - now.getTime();
        return Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));
    }
    get hoursUntilExpiry() {
        const now = new Date();
        const timeDiff = this.expiresAt.getTime() - now.getTime();
        return Math.max(0, Math.ceil(timeDiff / (1000 * 3600)));
    }
    get accessUrl() {
        // This will be set by the service layer with the actual frontend URL
        return `/public/invoice/${this.token}`;
    }
    // Methods
    recordAccess(ip, userAgent) {
        this.accessCount += 1;
        this.lastAccessedAt = new Date();
        if (ip) {
            this.lastAccessedIp = ip;
        }
        // Log the access
        if (!this.metadata.accessLog) {
            this.metadata.accessLog = [];
        }
        this.metadata.accessLog.push({
            timestamp: new Date().toISOString(),
            ip: ip || 'unknown',
            userAgent,
        });
        // Keep only last 50 access logs to prevent unbounded growth
        if (this.metadata.accessLog.length > 50) {
            this.metadata.accessLog = this.metadata.accessLog.slice(-50);
        }
    }
    deactivate() {
        this.isActive = false;
    }
    activate() {
        this.isActive = true;
    }
    extendExpiry(days) {
        const newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + days);
        this.expiresAt = newExpiryDate;
    }
    setPermissions(permissions) {
        this.metadata = {
            ...this.metadata,
            permissions: { ...this.metadata.permissions, ...permissions }
        };
    }
    setCustomMessage(message) {
        this.metadata = {
            ...this.metadata,
            customMessage: message
        };
    }
    // Static methods
    static generateSecureToken() {
        const crypto = require('crypto');
        return crypto.randomBytes(32).toString('hex');
    }
    static createAccessToken(invoiceId, expiresInDays = 30, clientEmail, clientName, createdBy) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        return {
            invoiceId,
            token: this.generateSecureToken(),
            clientEmail,
            clientName,
            expiresAt,
            createdBy,
            isActive: true,
            accessCount: 0,
            maxAccessCount: 100,
            metadata: {
                permissions: {
                    canDownload: true,
                    canPay: true,
                    canViewHistory: false,
                }
            }
        };
    }
    static validateToken(token) {
        return /^[a-f0-9]{64}$/.test(token);
    }
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    // JSON serialization
    toJSON() {
        return {
            id: this.id,
            invoiceId: this.invoiceId,
            token: this.token,
            clientEmail: this.clientEmail,
            clientName: this.clientName,
            expiresAt: this.expiresAt,
            lastAccessedAt: this.lastAccessedAt,
            accessCount: this.accessCount,
            maxAccessCount: this.maxAccessCount,
            isActive: this.isActive,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            // Computed properties
            isExpired: this.isExpired,
            isValid: this.isValid,
            remainingAccesses: this.remainingAccesses,
            daysUntilExpiry: this.daysUntilExpiry,
            hoursUntilExpiry: this.hoursUntilExpiry,
            accessUrl: this.accessUrl,
            metadata: {
                ...this.metadata,
                accessLog: undefined, // Don't expose full access log in JSON
                accessLogCount: this.metadata.accessLog?.length || 0,
            }
        };
    }
    // Minimal JSON for public use (hide sensitive data)
    toPublicJSON() {
        return {
            token: this.token,
            expiresAt: this.expiresAt,
            accessCount: this.accessCount,
            remainingAccesses: this.remainingAccesses,
            daysUntilExpiry: this.daysUntilExpiry,
            permissions: this.metadata.permissions,
            customMessage: this.metadata.customMessage,
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.InvoiceAccessToken = InvoiceAccessToken;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, unique: true, nullable: false }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "token", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_email', type: 'varchar', length: 320, nullable: true }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "clientEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "clientName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamptz', nullable: false }),
    __metadata("design:type", Date)
], InvoiceAccessToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_accessed_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], InvoiceAccessToken.prototype, "lastAccessedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_accessed_ip', type: 'varchar', length: 45, nullable: true }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "lastAccessedIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'access_count', type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], InvoiceAccessToken.prototype, "accessCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_access_count', type: 'integer', default: 100 }),
    __metadata("design:type", Number)
], InvoiceAccessToken.prototype, "maxAccessCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], InvoiceAccessToken.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], InvoiceAccessToken.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], InvoiceAccessToken.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], InvoiceAccessToken.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], InvoiceAccessToken.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Invoice_1.Invoice, invoice => invoice.accessTokens, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'invoice_id' }),
    __metadata("design:type", Invoice_1.Invoice)
], InvoiceAccessToken.prototype, "invoice", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], InvoiceAccessToken.prototype, "generateId", null);
exports.InvoiceAccessToken = InvoiceAccessToken = __decorate([
    (0, typeorm_1.Entity)('invoice_access_tokens'),
    (0, typeorm_1.Index)(['invoiceId']),
    (0, typeorm_1.Index)(['token'], { unique: true }),
    (0, typeorm_1.Index)(['expiresAt']),
    (0, typeorm_1.Index)(['invoiceId', 'token']),
    (0, typeorm_1.Check)('token_length', 'LENGTH(token) = 64'),
    (0, typeorm_1.Check)('access_count_positive', 'access_count >= 0'),
    (0, typeorm_1.Check)('expires_at_future', 'expires_at > created_at')
], InvoiceAccessToken);
//# sourceMappingURL=InvoiceAccessToken.js.map