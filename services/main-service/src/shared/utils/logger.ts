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
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          const logObject: any = {
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
        })
      ),
      transports: [
        new winston.transports.Console()
      ]
    });
  }

  private getRequestId(): string {
    // In AWS Lambda, request ID is available in the context
    return process.env.AWS_REQUEST_ID || 'local';
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

  setRequestId(requestId: string): void {
    process.env.AWS_REQUEST_ID = requestId;
  }
}