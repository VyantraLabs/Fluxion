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
exports.AuditLog = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
let AuditLog = class AuditLog {
    // Computed properties
    get displayAction() {
        const actionMap = {
            'CREATE': 'Created',
            'UPDATE': 'Updated',
            'DELETE': 'Deleted',
            'LOGIN': 'Logged In',
            'LOGOUT': 'Logged Out',
            'EXPORT': 'Exported',
            'IMPORT': 'Imported',
        };
        return actionMap[this.action] || this.action;
    }
    get displayTableName() {
        return this.tableName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    get userDisplayName() {
        return this.user?.displayName || 'System';
    }
    get shortIpAddress() {
        if (!this.ipAddress)
            return null;
        // For IPv4, show as is. For IPv6, show compressed format
        return this.ipAddress.toString();
    }
    get isHighRisk() {
        const highRiskActions = ['DELETE', 'EXPORT'];
        const highRiskTables = ['users', 'organization_settings', 'audit_logs'];
        return (this.adminAction ||
            highRiskActions.includes(this.action) ||
            highRiskTables.includes(this.tableName) ||
            this.severityLevel === 'high' ||
            this.severityLevel === 'critical' ||
            this.metadata?.severity === 'high' ||
            this.metadata?.severity === 'critical');
    }
    get age() {
        return Date.now() - this.createdAt.getTime();
    }
    get ageInHours() {
        return Math.floor(this.age / (1000 * 60 * 60));
    }
    get ageInDays() {
        return Math.floor(this.age / (1000 * 60 * 60 * 24));
    }
    // Methods
    toJSON() {
        return {
            ...this,
            displayAction: this.displayAction,
            displayTableName: this.displayTableName,
            userDisplayName: this.userDisplayName,
            shortIpAddress: this.shortIpAddress,
            isHighRisk: this.isHighRisk,
            age: this.age,
            ageInHours: this.ageInHours,
            ageInDays: this.ageInDays,
        };
    }
    getChanges() {
        if (!this.oldValues || !this.newValues)
            return [];
        const changes = [];
        // Find changed fields
        const allFields = new Set([
            ...Object.keys(this.oldValues || {}),
            ...Object.keys(this.newValues || {}),
        ]);
        allFields.forEach(field => {
            const oldValue = this.oldValues?.[field];
            const newValue = this.newValues?.[field];
            if (oldValue !== newValue) {
                changes.push({
                    field,
                    oldValue,
                    newValue,
                });
            }
        });
        return changes;
    }
    getSummary() {
        const userName = this.userDisplayName;
        const action = this.displayAction.toLowerCase();
        const table = this.displayTableName.toLowerCase();
        switch (this.action) {
            case 'CREATE':
                return `${userName} created a new ${table}`;
            case 'UPDATE':
                return `${userName} updated ${table}`;
            case 'DELETE':
                return `${userName} deleted ${table}`;
            case 'LOGIN':
                return `${userName} logged in`;
            case 'LOGOUT':
                return `${userName} logged out`;
            case 'EXPORT':
                return `${userName} exported ${table} data`;
            case 'IMPORT':
                return `${userName} imported ${table} data`;
            default:
                return `${userName} performed ${action} on ${table}`;
        }
    }
    // Static methods
    static createForEntity(organizationId, userId, tableName, entity, action, oldValues, metadata) {
        return {
            organizationId,
            userId,
            tableName,
            recordId: entity.id,
            action,
            oldValues,
            newValues: action !== 'DELETE' ? entity : undefined,
            metadata: metadata || {},
        };
    }
    static createForLogin(organizationId, userId, ipAddress, userAgent, metadata) {
        return {
            organizationId,
            userId,
            tableName: 'users',
            recordId: userId,
            action: 'LOGIN',
            ipAddress,
            userAgent,
            metadata: {
                ...metadata,
                source: 'web',
                severity: 'low',
            },
        };
    }
    static createForExport(organizationId, userId, tableName, recordCount, metadata) {
        return {
            organizationId,
            userId,
            tableName,
            recordId: organizationId, // Use organization ID as record ID for exports
            action: 'EXPORT',
            severityLevel: 'medium',
            metadata: {
                ...metadata,
                recordCount,
                severity: 'medium',
            },
        };
    }
    static createForAdminAction(organizationId, adminUserId, targetUserId, tableName, recordId, action, severityLevel = 'medium', oldValues, newValues, metadata) {
        return {
            organizationId,
            userId: targetUserId,
            tableName,
            recordId,
            action,
            adminAction: true,
            adminUserId,
            severityLevel,
            oldValues,
            newValues,
            metadata: {
                ...metadata,
                adminOperation: true,
                severity: severityLevel,
            },
        };
    }
    static createForSystemOperation(adminUserId, operation, details, severityLevel = 'high', metadata) {
        return {
            organizationId: 'system', // Special organization ID for system operations
            userId: adminUserId,
            tableName: 'system_operations',
            recordId: operation,
            action: 'UPDATE',
            adminAction: true,
            adminUserId,
            severityLevel,
            newValues: details,
            metadata: {
                ...metadata,
                systemOperation: true,
                operation,
                severity: severityLevel,
            },
        };
    }
    static validateAction(action) {
        return ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'].includes(action);
    }
    static validateTableName(tableName) {
        const validTables = [
            'organizations',
            'users',
            'blockchain_networks',
            'tokens',
            'smart_contracts',
            'invoices',
            'payments',
            'payroll_batches',
            'payroll_recipients',
            'organization_settings',
        ];
        return validTables.includes(tableName);
    }
    // Query helpers for common audit log searches
    static getRecentActivityQuery(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return { where: { createdAt: { $gte: cutoff } } };
    }
    static getHighRiskActivityQuery() {
        return {
            where: {
                $or: [
                    { action: { $in: ['DELETE', 'EXPORT'] } },
                    { 'metadata.severity': { $in: ['high', 'critical'] } },
                ],
            },
        };
    }
    static getUserActivityQuery(userId) {
        return { where: { userId } };
    }
    static getTableActivityQuery(tableName) {
        return { where: { tableName } };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
};
exports.AuditLog = AuditLog;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], AuditLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], AuditLog.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'table_name', type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], AuditLog.prototype, "tableName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'record_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], AuditLog.prototype, "recordId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: false }),
    __metadata("design:type", String)
], AuditLog.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'old_values', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "oldValues", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'new_values', type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AuditLog.prototype, "newValues", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ip_address', type: 'inet', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_agent', type: 'text', nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'admin_action', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], AuditLog.prototype, "adminAction", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'admin_user_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], AuditLog.prototype, "adminUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'severity_level', type: 'varchar', length: 20, default: 'low' }),
    __metadata("design:type", String)
], AuditLog.prototype, "severityLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', default: {}, nullable: false }),
    __metadata("design:type", Object)
], AuditLog.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], AuditLog.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, organization => organization.auditLogs, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", Organization_1.Organization)
], AuditLog.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, user => user.auditLogs, {
        nullable: true,
        onDelete: 'SET NULL',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_1.User)
], AuditLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuditLog.prototype, "generateId", null);
exports.AuditLog = AuditLog = __decorate([
    (0, typeorm_1.Entity)('audit_logs'),
    (0, typeorm_1.Index)(['organizationId']),
    (0, typeorm_1.Index)(['userId']),
    (0, typeorm_1.Index)(['tableName']),
    (0, typeorm_1.Index)(['recordId']),
    (0, typeorm_1.Index)(['action']),
    (0, typeorm_1.Index)(['createdAt']),
    (0, typeorm_1.Index)(['ipAddress'])
], AuditLog);
//# sourceMappingURL=AuditLog.js.map