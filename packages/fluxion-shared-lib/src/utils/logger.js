"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const winston_1 = __importDefault(require("winston"));
class Logger {
    constructor(context) {
        this.context = context;
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, stack, ...meta }) => {
                const logObject = {
                    timestamp,
                    level,
                    context: this.context,
                    message,
                    requestId: this.getRequestId(),
                    ...meta
                };
                if (stack && typeof stack === 'string') {
                    logObject.stack = stack;
                }
                return JSON.stringify(logObject);
            })),
            transports: [
                new winston_1.default.transports.Console()
            ]
        });
    }
    getRequestId() {
        // In AWS Lambda, request ID is available in the context
        return process.env.AWS_REQUEST_ID || 'local';
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    setRequestId(requestId) {
        process.env.AWS_REQUEST_ID = requestId;
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map