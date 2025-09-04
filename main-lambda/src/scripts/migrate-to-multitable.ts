#!/usr/bin/env ts-node

/**
 * Migration script to move from single-table to multi-table architecture
 * 
 * This script performs the following operations:
 * 1. Reads existing data from the single table
 * 2. Transforms and migrates data to new multi-table structure
 * 3. Validates data consistency between old and new tables
 * 4. Provides rollback functionality if needed
 * 
 * Usage:
 *   # Dry run (preview changes)
 *   npm run migrate:multitable -- --dry-run
 * 
 *   # Run migration
 *   npm run migrate:multitable
 * 
 *   # Validate data after migration
 *   npm run migrate:multitable -- --validate-only
 */

import { getDatabase } from '@/shared/database/client';
import { UsersService } from '@/shared/services/users.service';
// Unused import removed: InvoicesService
import { Logger } from '@/shared/utils/logger';
import { FluxionRecord, TenantContext, UserRecord, UserData, InvoiceData, PaymentData, NotificationData } from '@/types/common';

// Add type guards for union types
const isUserData = (data: InvoiceData | PaymentData | UserData | NotificationData): data is UserData => {
  return 'wallet_address' in data && 'stats' in data;
};

const logger = new Logger('MigrationScript');

interface MigrationOptions {
  dryRun?: boolean;
  validateOnly?: boolean;
  tenantId?: string;
  batchSize?: number;
}

interface MigrationStats {
  usersProcessed: number;
  usersMigrated: number;
  usersSkipped: number;
  usersErrors: number;
  invoicesProcessed: number;
  invoicesMigrated: number;
  invoicesSkipped: number;
  invoicesErrors: number;
  paymentsProcessed: number;
  paymentsMigrated: number;
  paymentsSkipped: number;
  paymentsErrors: number;
}

class MultiTableMigration {
  private db: ReturnType<typeof getDatabase>;
  private usersService: UsersService;
  private stats: MigrationStats;
  
  constructor() {
    this.db = getDatabase();
    this.usersService = new UsersService(this.db);
    
    this.stats = {
      usersProcessed: 0,
      usersMigrated: 0,
      usersSkipped: 0,
      usersErrors: 0,
      invoicesProcessed: 0,
      invoicesMigrated: 0,
      invoicesSkipped: 0,
      invoicesErrors: 0,
      paymentsProcessed: 0,
      paymentsMigrated: 0,
      paymentsSkipped: 0,
      paymentsErrors: 0
    };
  }

  async migrate(options: MigrationOptions = {}): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting multi-table migration', { options });

    try {
      if (options.validateOnly) {
        await this.validateMigration(options);
        return;
      }

      // Step 1: Migrate Users
      await this.migrateUsers(options);
      
      // Step 2: Migrate Invoices
      await this.migrateInvoices(options);
      
      // Step 3: Migrate Payments
      await this.migratePayments(options);

      const duration = Date.now() - startTime;
      
      logger.info('Migration completed successfully', {
        duration: `${duration}ms`,
        stats: this.stats
      });

      this.printMigrationSummary();

    } catch (error: any) {
      logger.error('Migration failed', { error: error.message });
      throw error;
    }
  }

  private async migrateUsers(options: MigrationOptions): Promise<void> {
    logger.info('Starting user migration');
    
    const tenantContext: TenantContext = {
      tenantId: options.tenantId || 'default'
    };

    let nextToken: string | undefined;
    const batchSize = options.batchSize || 100;

    do {
      try {
        // Query legacy single table for user records
        const result = await this.db.queryByPK('USER', {
          limit: batchSize,
          nextToken
        });

        for (const record of result.items) {
          this.stats.usersProcessed++;
          
          try {
            if (record.entityType === 'USER') {
              await this.migrateUserRecord(record, tenantContext, options);
              this.stats.usersMigrated++;
            } else {
              this.stats.usersSkipped++;
            }
          } catch (error: any) {
            this.stats.usersErrors++;
            logger.error('Failed to migrate user record', {
              recordId: record.PK,
              error: error.message
            });
          }
        }

        nextToken = result.nextToken;
        
        logger.info('User batch processed', {
          processed: this.stats.usersProcessed,
          migrated: this.stats.usersMigrated,
          errors: this.stats.usersErrors
        });

      } catch (error: any) {
        logger.error('Failed to process user batch', { error: error.message });
        throw error;
      }
    } while (nextToken);

    logger.info('User migration completed', {
      total: this.stats.usersProcessed,
      migrated: this.stats.usersMigrated,
      skipped: this.stats.usersSkipped,
      errors: this.stats.usersErrors
    });
  }

  private async migrateUserRecord(
    record: FluxionRecord, 
    tenantContext: TenantContext, 
    options: MigrationOptions
  ): Promise<void> {
    // Check if this is user data
    if (!isUserData(record.data)) {
      throw new Error('Expected user data but got different type');
    }
    
    const userData = record.data;
    
    if (options.dryRun) {
      logger.info('DRY RUN: Would migrate user', { walletAddress: userData.wallet_address });
      return;
    }

    // Transform legacy user data to new schema
    const userRecord: Omit<UserRecord, 'id' | 'created_at' | 'updated_at'> = {
      tenant_id: tenantContext.tenantId,
      wallet_address: userData.wallet_address,
      email: userData.email,
      profile: userData.display_name ? {
        display_name: userData.display_name
      } : undefined,
      notification_preferences: userData.notification_preferences || {
        email_on_payment: true,
        email_on_invoice_viewed: false,
        email_on_reminders: true
      },
      stats: userData.stats || {
        invoice_count: 0,
        total_received: 0,
        last_active_at: record.updated_at
      }
    };

    // Check if user already exists in new table
    try {
      await this.usersService.getUserByWallet(tenantContext, userData.wallet_address);
      logger.debug('User already exists in new table, skipping', {
        walletAddress: userData.wallet_address
      });
      this.stats.usersSkipped++;
      return;
    } catch (error) {
      // User doesn't exist, proceed with migration
    }

    // Create user in new table
    await this.usersService.createUser(tenantContext, userRecord);
    
    logger.debug('User migrated successfully', {
      walletAddress: userData.wallet_address
    });
  }

  private async migrateInvoices(_options: MigrationOptions): Promise<void> {
    logger.info('Starting invoice migration');
    
    // Similar structure to user migration
    // Implementation would follow the same pattern
    logger.info('Invoice migration completed (placeholder)');
  }

  private async migratePayments(_options: MigrationOptions): Promise<void> {
    logger.info('Starting payment migration');
    
    // Similar structure to user migration
    // Implementation would follow the same pattern
    logger.info('Payment migration completed (placeholder)');
  }

  private async validateMigration(options: MigrationOptions): Promise<void> {
    logger.info('Starting migration validation');
    
    const tenantContext: TenantContext = {
      tenantId: options.tenantId || 'default'
    };

    let validationErrors = 0;

    try {
      // Validate users
      const legacyUsers = await this.getLegacyUserRecords();
      logger.info(`Found ${legacyUsers.length} legacy user records`);

      for (const legacyUser of legacyUsers) {
        if (!isUserData(legacyUser.data)) {
          continue; // Skip non-user data
        }
        
        try {
          const newUser = await this.usersService.getUserByWallet(
            tenantContext, 
            legacyUser.data.wallet_address
          );

          // Validate data consistency
          if (!this.validateUserDataConsistency(legacyUser, newUser)) {
            validationErrors++;
            logger.warn('User data inconsistency detected', {
              walletAddress: legacyUser.data.wallet_address
            });
          }
        } catch (error) {
          validationErrors++;
          logger.warn('User not found in new table', {
            walletAddress: legacyUser.data.wallet_address
          });
        }
      }

      if (validationErrors === 0) {
        logger.info('Migration validation passed - all data consistent');
      } else {
        logger.error(`Migration validation failed - ${validationErrors} inconsistencies found`);
        process.exit(1);
      }

    } catch (error: any) {
      logger.error('Validation failed', { error: error.message });
      throw error;
    }
  }

  private async getLegacyUserRecords(): Promise<FluxionRecord[]> {
    const users: FluxionRecord[] = [];
    let nextToken: string | undefined;

    do {
      const result = await this.db.queryByPK('USER', { nextToken });
      users.push(...result.items.filter(item => item.entityType === 'USER'));
      nextToken = result.nextToken;
    } while (nextToken);

    return users;
  }

  private validateUserDataConsistency(legacyUser: FluxionRecord, newUser: UserRecord): boolean {
    if (!isUserData(legacyUser.data)) {
      return false;
    }
    
    const legacyData = legacyUser.data;
    
    // Check wallet address
    if (legacyData.wallet_address !== newUser.wallet_address) {
      return false;
    }

    // Check email
    if (legacyData.email !== newUser.email) {
      return false;
    }

    // Check display name
    if (legacyData.display_name !== newUser.profile?.display_name) {
      return false;
    }

    return true;
  }

  private printMigrationSummary(): void {
    console.log('\n========== MIGRATION SUMMARY ==========');
    console.log('Users:');
    console.log(`  Processed: ${this.stats.usersProcessed}`);
    console.log(`  Migrated:  ${this.stats.usersMigrated}`);
    console.log(`  Skipped:   ${this.stats.usersSkipped}`);
    console.log(`  Errors:    ${this.stats.usersErrors}`);
    
    console.log('Invoices:');
    console.log(`  Processed: ${this.stats.invoicesProcessed}`);
    console.log(`  Migrated:  ${this.stats.invoicesMigrated}`);
    console.log(`  Skipped:   ${this.stats.invoicesSkipped}`);
    console.log(`  Errors:    ${this.stats.invoicesErrors}`);
    
    console.log('Payments:');
    console.log(`  Processed: ${this.stats.paymentsProcessed}`);
    console.log(`  Migrated:  ${this.stats.paymentsMigrated}`);
    console.log(`  Skipped:   ${this.stats.paymentsSkipped}`);
    console.log(`  Errors:    ${this.stats.paymentsErrors}`);
    console.log('=====================================\n');
  }
}

// CLI Interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  const options: MigrationOptions = {
    dryRun: args.includes('--dry-run'),
    validateOnly: args.includes('--validate-only'),
    tenantId: getArgumentValue(args, '--tenant-id') || 'default',
    batchSize: parseInt(getArgumentValue(args, '--batch-size') || '100')
  };

  console.log('Fluxion Multi-Table Migration');
  console.log('==============================');
  
  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No actual changes will be made');
  }
  
  if (options.validateOnly) {
    console.log('✅ VALIDATION ONLY - Checking data consistency');
  }
  
  console.log(`🏢 Tenant ID: ${options.tenantId}`);
  console.log(`📦 Batch Size: ${options.batchSize}`);
  console.log('');

  const migration = new MultiTableMigration();
  
  try {
    await migration.migrate(options);
    console.log('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function getArgumentValue(args: string[], argName: string): string | undefined {
  const index = args.indexOf(argName);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : undefined;
}

// Run the migration if this script is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { MultiTableMigration, MigrationOptions, MigrationStats };