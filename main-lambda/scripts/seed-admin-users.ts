#!/usr/bin/env ts-node

/**
 * CLI script to seed admin users for the Fluxion system
 * 
 * Usage:
 *   npm run seed:admin-users
 *   or
 *   npx ts-node scripts/seed-admin-users.ts
 * 
 * Environment Variables:
 *   SUPER_ADMIN_WALLET - Wallet address for the super admin user
 *   SUPPORT_ADMIN_WALLET - Wallet address for the support admin user  
 *   ADMIN_NOTIFICATION_EMAIL - Email for admin notifications
 *   CUSTOM_ADMIN_USERS - JSON array of additional admin users to create
 * 
 * Example CUSTOM_ADMIN_USERS:
 * [
 *   {
 *     "email": "dev@company.com",
 *     "walletAddress": "0x1234...",
 *     "firstName": "Dev",
 *     "lastName": "Team",
 *     "isSuperAdmin": false,
 *     "organizationName": "Development Team"
 *   }
 * ]
 */

import { Command } from 'commander';
import { AdminUserSeeder, AdminUserSeedData, runAdminUserSeed } from '@/database/seeds/admin-users.seed';
import { AppDataSource } from '@/database/data-source';
import { Logger } from '@/shared/utils/logger';

const logger = new Logger('AdminUsersCLI');
const program = new Command();

program
  .name('seed-admin-users')
  .description('Seed admin users for the Fluxion system')
  .version('1.0.0');

program
  .command('seed')
  .description('Seed default admin users and system settings')
  .action(async () => {
    try {
      await runAdminUserSeed();
      logger.info('Admin user seeding completed successfully');
    } catch (error: any) {
      logger.error('Admin user seeding failed', { error: error.message });
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all current admin users')
  .action(async () => {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      const seeder = new AdminUserSeeder(AppDataSource);
      const adminUsers = await seeder.listAdminUsers();

      console.log('\n=== ADMIN USERS ===\n');
      
      if (adminUsers.length === 0) {
        console.log('No admin users found.');
        return;
      }

      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.displayName} (${user.email})`);
        console.log(`   Wallet: ${user.walletAddress}`);
        console.log(`   Organization: ${user.organization?.name || 'Unknown'}`);
        console.log(`   Admin: ${user.isAdmin ? 'Yes' : 'No'}`);
        console.log(`   Super Admin: ${user.isSuperAdmin ? 'Yes' : 'No'}`);
        console.log(`   Active: ${user.isActive ? 'Yes' : 'No'}`);
        console.log(`   Created: ${user.createdAt.toISOString()}`);
        if (user.adminGrantedAt) {
          console.log(`   Admin Since: ${user.adminGrantedAt.toISOString()}`);
        }
        console.log('');
      });

      const superAdminCount = adminUsers.filter(u => u.isSuperAdmin).length;
      const regularAdminCount = adminUsers.filter(u => u.isAdmin && !u.isSuperAdmin).length;

      console.log(`Total: ${adminUsers.length} admin users (${superAdminCount} super admins, ${regularAdminCount} regular admins)`);

    } catch (error: any) {
      logger.error('Failed to list admin users', { error: error.message });
      process.exit(1);
    }
  });

program
  .command('grant <userIdentifier>')
  .description('Grant admin privileges to a user (by email or wallet address)')
  .option('-s, --super', 'Grant super admin privileges')
  .option('-g, --granted-by <grantedBy>', 'User ID granting the privileges', 'system')
  .action(async (userIdentifier: string, options) => {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      const seeder = new AdminUserSeeder(AppDataSource);
      const updatedUser = await seeder.grantAdminPrivileges(
        userIdentifier,
        options.super || false,
        options.grantedBy
      );

      console.log('\n=== ADMIN PRIVILEGES GRANTED ===\n');
      console.log(`User: ${updatedUser.displayName} (${updatedUser.email})`);
      console.log(`Wallet: ${updatedUser.walletAddress}`);
      console.log(`Admin: ${updatedUser.isAdmin ? 'Yes' : 'No'}`);
      console.log(`Super Admin: ${updatedUser.isSuperAdmin ? 'Yes' : 'No'}`);
      console.log(`Granted By: ${updatedUser.adminGrantedBy}`);
      console.log(`Granted At: ${updatedUser.adminGrantedAt?.toISOString()}`);

    } catch (error: any) {
      logger.error('Failed to grant admin privileges', { 
        error: error.message,
        userIdentifier 
      });
      process.exit(1);
    }
  });

program
  .command('revoke <userIdentifier>')
  .description('Revoke admin privileges from a user (by email or wallet address)')
  .option('-r, --revoked-by <revokedBy>', 'User ID revoking the privileges', 'system')
  .action(async (userIdentifier: string, options) => {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      const seeder = new AdminUserSeeder(AppDataSource);
      const updatedUser = await seeder.revokeAdminPrivileges(
        userIdentifier,
        options.revokedBy
      );

      console.log('\n=== ADMIN PRIVILEGES REVOKED ===\n');
      console.log(`User: ${updatedUser.displayName} (${updatedUser.email})`);
      console.log(`Wallet: ${updatedUser.walletAddress}`);
      console.log(`Admin: ${updatedUser.isAdmin ? 'Yes' : 'No'}`);
      console.log(`Super Admin: ${updatedUser.isSuperAdmin ? 'Yes' : 'No'}`);

    } catch (error: any) {
      logger.error('Failed to revoke admin privileges', { 
        error: error.message,
        userIdentifier 
      });
      process.exit(1);
    }
  });

program
  .command('create')
  .description('Create a custom admin user interactively')
  .action(async () => {
    const readline = await import('readline');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise(resolve => {
        rl.question(prompt, resolve);
      });
    };

    try {
      console.log('\n=== CREATE ADMIN USER ===\n');

      const email = await question('Email address: ');
      const walletAddress = await question('Wallet address: ');
      const firstName = await question('First name (optional): ');
      const lastName = await question('Last name (optional): ');
      const isSuperAdmin = (await question('Super admin? (y/n): ')).toLowerCase() === 'y';
      const organizationName = await question('Organization name (optional): ');

      rl.close();

      if (!email || !walletAddress) {
        throw new Error('Email and wallet address are required');
      }

      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        throw new Error('Invalid wallet address format');
      }

      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      const seeder = new AdminUserSeeder(AppDataSource);
      const adminData: AdminUserSeedData = {
        email,
        walletAddress,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        isSuperAdmin,
        organizationName: organizationName || undefined
      };

      const result = await seeder.createAdminUser(adminData);

      console.log('\n=== ADMIN USER CREATED ===\n');
      console.log(`Status: ${result.created ? 'Created new user' : 'Updated existing user'}`);
      console.log(`User: ${result.user.displayName} (${result.user.email})`);
      console.log(`Wallet: ${result.user.walletAddress}`);
      console.log(`Organization: ${result.user.organization?.name || 'Unknown'}`);
      console.log(`Admin: ${result.user.isAdmin ? 'Yes' : 'No'}`);
      console.log(`Super Admin: ${result.user.isSuperAdmin ? 'Yes' : 'No'}`);

    } catch (error: any) {
      rl.close();
      logger.error('Failed to create admin user', { error: error.message });
      process.exit(1);
    }
  });

// Help command
program
  .command('help-env')
  .description('Show help for environment variables')
  .action(() => {
    console.log(`
=== ENVIRONMENT VARIABLES ===

SUPER_ADMIN_WALLET
  Wallet address for the default super admin user
  Default: 0x0000000000000000000000000000000000000001
  
SUPPORT_ADMIN_WALLET
  Wallet address for the default support admin user
  Default: 0x0000000000000000000000000000000000000002

ADMIN_NOTIFICATION_EMAIL
  Email address for admin notifications
  Default: admin@fluxion.pay

CUSTOM_ADMIN_USERS
  JSON array of additional admin users to create
  Example:
  CUSTOM_ADMIN_USERS='[
    {
      "email": "dev@company.com",
      "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
      "firstName": "Dev",
      "lastName": "Team", 
      "isSuperAdmin": false,
      "organizationName": "Development Team"
    }
  ]'

=== USAGE EXAMPLES ===

# Seed default admin users
npm run seed:admin-users seed

# List all admin users  
npm run seed:admin-users list

# Grant admin privileges
npm run seed:admin-users grant user@example.com
npm run seed:admin-users grant 0x1234... --super

# Revoke admin privileges
npm run seed:admin-users revoke user@example.com

# Create custom admin user interactively
npm run seed:admin-users create

# Show this help
npm run seed:admin-users help-env
`);
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}