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
var RolePermission_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolePermission = void 0;
const typeorm_1 = require("typeorm");
const ulid_1 = require("ulid");
const Role_1 = require("./Role");
const Permission_1 = require("./Permission");
let RolePermission = RolePermission_1 = class RolePermission {
    // Computed properties
    get isValid() {
        return this.isActive && !this.deletedAt;
    }
    // Methods
    toJSON() {
        const { deletedAt, ...rest } = this;
        return {
            ...rest,
            isValid: this.isValid,
        };
    }
    generateId() {
        if (!this.id) {
            this.id = (0, ulid_1.ulid)();
        }
    }
    // Static methods
    static create(roleId, permissionId, grantedBy) {
        const rolePermission = new RolePermission_1();
        rolePermission.roleId = roleId;
        rolePermission.permissionId = permissionId;
        rolePermission.grantedBy = grantedBy;
        rolePermission.grantedAt = new Date();
        rolePermission.isActive = true;
        return rolePermission;
    }
};
exports.RolePermission = RolePermission;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar' }),
    __metadata("design:type", String)
], RolePermission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'role_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], RolePermission.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'permission_id', type: 'varchar', nullable: false }),
    __metadata("design:type", String)
], RolePermission.prototype, "permissionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_by', type: 'varchar', nullable: true }),
    __metadata("design:type", String)
], RolePermission.prototype, "grantedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_at', type: 'timestamptz', nullable: false, default: () => 'CURRENT_TIMESTAMP' }),
    __metadata("design:type", Date)
], RolePermission.prototype, "grantedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], RolePermission.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], RolePermission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], RolePermission.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at', nullable: true }),
    __metadata("design:type", Date)
], RolePermission.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Role_1.Role, role => role.permissions, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'role_id' }),
    __metadata("design:type", Role_1.Role)
], RolePermission.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Permission_1.Permission, permission => permission.rolePermissions, {
        nullable: false,
        onDelete: 'CASCADE',
    }),
    (0, typeorm_1.JoinColumn)({ name: 'permission_id' }),
    __metadata("design:type", Permission_1.Permission)
], RolePermission.prototype, "permission", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], RolePermission.prototype, "generateId", null);
exports.RolePermission = RolePermission = RolePermission_1 = __decorate([
    (0, typeorm_1.Entity)('role_permissions'),
    (0, typeorm_1.Index)(['roleId', 'permissionId'], { unique: true }),
    (0, typeorm_1.Index)(['roleId']),
    (0, typeorm_1.Index)(['permissionId'])
], RolePermission);
//# sourceMappingURL=RolePermission.js.map