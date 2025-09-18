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
exports.Role = exports.OrganizationRoleKey = exports.SystemRoleKey = exports.RoleType = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const UserRole_1 = require("./UserRole");
const RolePermission_1 = require("./RolePermission");
var RoleType;
(function (RoleType) {
    RoleType["SYSTEM"] = "system";
    RoleType["ORGANIZATION"] = "organization"; // Organization-scoped roles
})(RoleType || (exports.RoleType = RoleType = {}));
var SystemRoleKey;
(function (SystemRoleKey) {
    SystemRoleKey["SUPER_ADMIN"] = "super_admin";
    SystemRoleKey["ADMIN"] = "admin";
    SystemRoleKey["SUPPORT"] = "support";
})(SystemRoleKey || (exports.SystemRoleKey = SystemRoleKey = {}));
var OrganizationRoleKey;
(function (OrganizationRoleKey) {
    OrganizationRoleKey["OWNER"] = "owner";
    OrganizationRoleKey["ORG_ADMIN"] = "org_admin";
    OrganizationRoleKey["MANAGER"] = "manager";
    OrganizationRoleKey["MEMBER"] = "member";
    OrganizationRoleKey["VIEWER"] = "viewer";
    OrganizationRoleKey["CLIENT"] = "client";
})(OrganizationRoleKey || (exports.OrganizationRoleKey = OrganizationRoleKey = {}));
let Role = class Role {
    // Computed properties
    get isSystemAdmin() {
        return this.key === SystemRoleKey.SUPER_ADMIN || this.key === SystemRoleKey.ADMIN;
    }
    get canCrossOrganizations() {
        return this.type === RoleType.SYSTEM;
    }
    // Methods
    toJSON() {
        const { deletedAt, ...rest } = this;
        return {
            ...rest,
            isSystemAdmin: this.isSystemAdmin,
            canCrossOrganizations: this.canCrossOrganizations,
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
    // Static methods
    static isValidSystemRole(key) {
        return Object.values(SystemRoleKey).includes(key);
    }
    static isValidOrganizationRole(key) {
        return Object.values(OrganizationRoleKey).includes(key);
    }
    static getDefaultPermissionsForRole(key) {
        const permissionMap = {
            // System roles
            [SystemRoleKey.SUPER_ADMIN]: [
                'system:*',
                'org:*',
                'invoice:*',
                'payment:*',
                'user:*',
                'reports:*'
            ],
            [SystemRoleKey.ADMIN]: [
                'system:networks',
                'system:tokens',
                'system:settings',
                'system:audit',
                'system:cross_tenant'
            ],
            [SystemRoleKey.SUPPORT]: [
                'invoice:read_all',
                'payment:read',
                'user:read',
                'reports:view',
                'system:cross_tenant'
            ],
            // Organization roles
            [OrganizationRoleKey.OWNER]: [
                'org:*',
                'user:*',
                'invoice:*',
                'payment:*',
                'reports:*'
            ],
            [OrganizationRoleKey.ORG_ADMIN]: [
                'org:settings',
                'org:branding',
                'user:invite',
                'user:manage',
                'invoice:*',
                'payment:*',
                'reports:view'
            ],
            [OrganizationRoleKey.MANAGER]: [
                'invoice:create',
                'invoice:read_all',
                'invoice:update',
                'invoice:send',
                'payment:initiate',
                'payment:verify',
                'reports:view'
            ],
            [OrganizationRoleKey.MEMBER]: [
                'invoice:create',
                'invoice:read',
                'invoice:update',
                'invoice:send',
                'payment:initiate'
            ],
            [OrganizationRoleKey.VIEWER]: [
                'invoice:read',
                'payment:read'
            ],
            [OrganizationRoleKey.CLIENT]: [
                'invoice:read',
                'payment:initiate'
            ]
        };
        return permissionMap[key] || [];
    }
};
exports.Role = Role;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], Role.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, nullable: false }),
    __metadata("design:type", String)
], Role.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: false }),
    __metadata("design:type", String)
], Role.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Role.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: RoleType,
        nullable: false,
    }),
    __metadata("design:type", String)
], Role.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_system_role', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Role.prototype, "isSystemRole", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Role.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'integer', default: 0 }),
    __metadata("design:type", Number)
], Role.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Role.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Role.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], Role.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => UserRole_1.UserRole, userRole => userRole.role),
    __metadata("design:type", Array)
], Role.prototype, "userRoles", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => RolePermission_1.RolePermission, rolePermission => rolePermission.role, { cascade: true }),
    __metadata("design:type", Array)
], Role.prototype, "permissions", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Role.prototype, "generateId", null);
exports.Role = Role = __decorate([
    (0, typeorm_1.Entity)('roles'),
    (0, typeorm_1.Index)(['key', 'type'], { unique: true }),
    (0, typeorm_1.Index)(['type'])
], Role);
//# sourceMappingURL=Role.js.map