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
exports.SystemSettings = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
let SystemSettings = class SystemSettings {
    // Computed properties
    get displayName() {
        return this.key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    get isSystemCritical() {
        const criticalKeys = [
            'maintenance_mode',
            'database_url',
            'jwt_secret',
            'encryption_key',
            'admin_api_key'
        ];
        return criticalKeys.includes(this.key);
    }
    get typedValue() {
        if (typeof this.value === 'string') {
            // Try to parse JSON strings
            try {
                return JSON.parse(this.value);
            }
            catch {
                // Handle special string values
                if (this.value === 'true')
                    return true;
                if (this.value === 'false')
                    return false;
                if (!isNaN(Number(this.value)))
                    return Number(this.value);
                return this.value;
            }
        }
        return this.value;
    }
    // Methods
    toJSON() {
        const { isEncrypted, value, ...rest } = this;
        return {
            ...rest,
            value: isEncrypted ? '[ENCRYPTED]' : this.typedValue,
            displayName: this.displayName,
            isSystemCritical: this.isSystemCritical,
        };
    }
    setValue(newValue, updatedBy) {
        this.value = newValue;
        this.updatedBy = updatedBy;
    }
    getBooleanValue() {
        const val = this.typedValue;
        if (typeof val === 'boolean')
            return val;
        if (typeof val === 'string')
            return val.toLowerCase() === 'true';
        if (typeof val === 'number')
            return val !== 0;
        return false;
    }
    getNumberValue(defaultValue = 0) {
        const val = this.typedValue;
        if (typeof val === 'number')
            return val;
        if (typeof val === 'string') {
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? defaultValue : parsed;
        }
        return defaultValue;
    }
    getStringValue(defaultValue = '') {
        const val = this.typedValue;
        return typeof val === 'string' ? val : String(val || defaultValue);
    }
    getArrayValue(defaultValue = []) {
        const val = this.typedValue;
        return Array.isArray(val) ? val : defaultValue;
    }
    getObjectValue(defaultValue = {}) {
        const val = this.typedValue;
        return typeof val === 'object' && val !== null && !Array.isArray(val) ? val : defaultValue;
    }
    // Static factory methods
    static create(key, value, category = 'general', options = {}) {
        return {
            key,
            value,
            category,
            description: options.description,
            isPublic: options.isPublic ?? false,
            isEncrypted: options.isEncrypted ?? false,
            updatedBy: options.updatedBy,
        };
    }
    static createMaintenanceMode(enabled, updatedBy) {
        return this.create('maintenance_mode', enabled, 'system', {
            description: 'Enable/disable system maintenance mode',
            isPublic: false,
            updatedBy,
        });
    }
    static createRateLimit(requestsPerMinute, updatedBy) {
        return this.create('rate_limit_requests_per_minute', requestsPerMinute, 'security', {
            description: 'API rate limit per IP per minute',
            isPublic: false,
            updatedBy,
        });
    }
    // Static validation methods
    static validateKey(key) {
        const keyPattern = /^[a-z0-9_]+$/;
        return keyPattern.test(key) && key.length <= 255;
    }
    static validateCategory(category) {
        return ['system', 'security', 'limits', 'notifications', 'integrations', 'general'].includes(category);
    }
    // Static query helpers
    static getByKeyQuery(key) {
        return { where: { key } };
    }
    static getByCategoryQuery(category) {
        return { where: { category } };
    }
    static getPublicSettingsQuery() {
        return { where: { isPublic: true } };
    }
    static getCriticalSettingsQuery() {
        const criticalKeys = [
            'maintenance_mode',
            'database_url',
            'jwt_secret',
            'encryption_key',
            'admin_api_key'
        ];
        return { where: { key: { $in: criticalKeys } } };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.SystemSettings = SystemSettings;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: false, unique: true }),
    __metadata("design:type", String)
], SystemSettings.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: false }),
    __metadata("design:type", Object)
], SystemSettings.prototype, "value", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, default: 'general' }),
    __metadata("design:type", String)
], SystemSettings.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], SystemSettings.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_public', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], SystemSettings.prototype, "isPublic", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_encrypted', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], SystemSettings.prototype, "isEncrypted", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], SystemSettings.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], SystemSettings.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'updated_by', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], SystemSettings.prototype, "updatedBy", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemSettings.prototype, "generateId", null);
exports.SystemSettings = SystemSettings = __decorate([
    (0, typeorm_1.Entity)('system_settings'),
    (0, typeorm_1.Index)(['key'], { unique: true }),
    (0, typeorm_1.Index)(['category']),
    (0, typeorm_1.Index)(['isPublic'])
], SystemSettings);
//# sourceMappingURL=SystemSettings.js.map