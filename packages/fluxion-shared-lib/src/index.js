"use strict";
// Essential exports for microservices
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = exports.Logger = exports.AppDataSource = exports.RolePermission = exports.UserRole = exports.Permission = exports.Role = exports.Template = exports.AuditLog = exports.Token = exports.BlockchainNetwork = exports.Payment = exports.Invoice = exports.Organization = exports.User = void 0;
// Core types
__exportStar(require("./types/common"), exports);
__exportStar(require("./types/config"), exports);
__exportStar(require("./types/invoice"), exports);
__exportStar(require("./types/payment"), exports);
__exportStar(require("./types/user"), exports);
// Database entities - minimal exports
var User_1 = require("./database/entities/User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return User_1.User; } });
var Organization_1 = require("./database/entities/Organization");
Object.defineProperty(exports, "Organization", { enumerable: true, get: function () { return Organization_1.Organization; } });
var Invoice_1 = require("./database/entities/Invoice");
Object.defineProperty(exports, "Invoice", { enumerable: true, get: function () { return Invoice_1.Invoice; } });
var Payment_1 = require("./database/entities/Payment");
Object.defineProperty(exports, "Payment", { enumerable: true, get: function () { return Payment_1.Payment; } });
var BlockchainNetwork_1 = require("./database/entities/BlockchainNetwork");
Object.defineProperty(exports, "BlockchainNetwork", { enumerable: true, get: function () { return BlockchainNetwork_1.BlockchainNetwork; } });
var Token_1 = require("./database/entities/Token");
Object.defineProperty(exports, "Token", { enumerable: true, get: function () { return Token_1.Token; } });
var AuditLog_1 = require("./database/entities/AuditLog");
Object.defineProperty(exports, "AuditLog", { enumerable: true, get: function () { return AuditLog_1.AuditLog; } });
var Template_1 = require("./database/entities/Template");
Object.defineProperty(exports, "Template", { enumerable: true, get: function () { return Template_1.Template; } });
var Role_1 = require("./database/entities/Role");
Object.defineProperty(exports, "Role", { enumerable: true, get: function () { return Role_1.Role; } });
var Permission_1 = require("./database/entities/Permission");
Object.defineProperty(exports, "Permission", { enumerable: true, get: function () { return Permission_1.Permission; } });
var UserRole_1 = require("./database/entities/UserRole");
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return UserRole_1.UserRole; } });
var RolePermission_1 = require("./database/entities/RolePermission");
Object.defineProperty(exports, "RolePermission", { enumerable: true, get: function () { return RolePermission_1.RolePermission; } });
// Database connection
var data_source_1 = require("./database/data-source");
Object.defineProperty(exports, "AppDataSource", { enumerable: true, get: function () { return data_source_1.AppDataSource; } });
// Error handling
__exportStar(require("./errors/index"), exports);
// Utilities
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
// Config
var index_1 = require("./config/index");
Object.defineProperty(exports, "config", { enumerable: true, get: function () { return index_1.config; } });
// Validation schemas
__exportStar(require("./validation/index"), exports);
//# sourceMappingURL=index.js.map