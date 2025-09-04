import winston from 'winston';

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string) {
    this.context = context;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const requestId = process.env.AWS_REQUEST_ID || meta.requestId || 'unknown';
          const contextStr = this.context ? `[${this.context}]` : '';
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level.toUpperCase()} ${contextStr} [${requestId}] ${message}${metaStr}`;
        })
      ),
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }
}

export default Logger;