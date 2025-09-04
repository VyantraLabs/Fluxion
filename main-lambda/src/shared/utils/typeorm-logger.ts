import { Logger as TypeOrmLogger } from 'typeorm';
import { Logger } from './logger';

/**
 * Custom TypeORM logger to reduce verbose SQL logging
 * Only logs important queries and errors, filters out routine operations
 */
export class CustomTypeOrmLogger implements TypeOrmLogger {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('TypeORM');
  }

  /**
   * Logs query and parameters used in it.
   */
  logQuery(query: string, parameters?: any[]) {
    // Filter out verbose queries that clutter the logs
    const verbosePatterns = [
      /^SELECT.*FROM.*information_schema/i,
      /^SELECT.*FROM.*pg_catalog/i, 
      /^SELECT.*version\(\)/i,
      /^SELECT.*current_schema\(\)/i,
      /^SELECT.*current_database\(\)/i,
      /^START TRANSACTION/i,
      /^COMMIT/i,
      /^ROLLBACK/i,
      /^SET LOCAL/i,
    ];

    const shouldSkip = verbosePatterns.some(pattern => pattern.test(query));
    
    if (!shouldSkip) {
      // Only log important queries with a more readable format
      const cleanQuery = query.replace(/\s+/g, ' ').trim();
      this.logger.debug('SQL Query', { 
        query: cleanQuery,
        parameters: parameters && parameters.length > 0 ? parameters : undefined
      });
    }
  }

  /**
   * Logs query that is failed.
   */
  logQueryError(error: string | Error, query: string, parameters?: any[]) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    this.logger.error('SQL Query Failed', {
      error: errorMessage,
      query: query.replace(/\s+/g, ' ').trim(),
      parameters: parameters && parameters.length > 0 ? parameters : undefined
    });
  }

  /**
   * Logs query that is slow.
   */
  logQuerySlow(time: number, query: string, parameters?: any[]) {
    this.logger.warn('Slow SQL Query', {
      executionTime: `${time}ms`,
      query: query.replace(/\s+/g, ' ').trim(),
      parameters: parameters && parameters.length > 0 ? parameters : undefined
    });
  }

  /**
   * Logs events from the schema build process.
   */
  logSchemaBuild(message: string) {
    this.logger.info('Schema Build', { message });
  }

  /**
   * Logs events from the migration run process.
   */
  logMigration(message: string) {
    this.logger.info('Migration', { message });
  }

  /**
   * Perform logging using given logger, or by default to the console.
   */
  log(level: 'log' | 'info' | 'warn', message: any) {
    switch (level) {
      case 'log':
      case 'info':
        // Skip routine TypeORM info messages that clutter logs
        if (typeof message === 'string' && (
          message.includes('query:') ||
          message.includes('executing query') ||
          message.includes('parameters:')
        )) {
          return;
        }
        this.logger.info(message);
        break;
      case 'warn':
        this.logger.warn(message);
        break;
      default:
        this.logger.debug(message);
    }
  }
}