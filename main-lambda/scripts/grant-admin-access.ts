#!/usr/bin/env ts-node
import { AppDataSource } from '../src/database/data-source';
import { User } from '../src/database/entities/User';

interface GrantAdminOptions {
  walletAddress?: string;
  email?: string;
  userId?: string;
  super?: boolean;
  role?: 'admin' | 'owner';
}

async function grantAdminAccess(options: GrantAdminOptions) {
  try {
    // Initialize database connection
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ Database connected');
    }

    const userRepository = AppDataSource.getRepository(User);
    
    let user: User | null = null;

    // Find user by different criteria
    if (options.userId) {
      user = await userRepository.findOne({ where: { id: options.userId } });
    } else if (options.walletAddress) {
      user = await userRepository.findOne({ where: { walletAddress: options.walletAddress } });
    } else if (options.email) {
      user = await userRepository.findOne({ where: { email: options.email } });
    }

    if (!user) {
      console.error('❌ User not found with provided criteria');
      process.exit(1);
    }

    console.log('👤 Found user:', {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      current_role: user.role,
      current_is_admin: user.isAdmin,
      current_is_super_admin: user.isSuperAdmin
    });

    // Determine new role and flags based on options
    const isSuper = options.super || false;
    const newRole = options.role || (isSuper ? 'owner' : 'admin');
    
    // Update user with admin privileges
    user.role = newRole;
    user.isAdmin = true;
    user.isSuperAdmin = isSuper;
    user.adminGrantedAt = new Date();
    user.adminGrantedBy = user.id; // Self-granted for script
    user.updatedAt = new Date();

    // Save the user
    await userRepository.save(user);

    console.log('✅ Admin access granted successfully!');
    console.log('📊 Updated user:', {
      id: user.id,
      email: user.email,
      walletAddress: user.walletAddress,
      new_role: user.role,
      new_is_admin: user.isAdmin,
      new_is_super_admin: user.isSuperAdmin,
      admin_granted_at: user.adminGrantedAt
    });

    // Verify the changes
    const verifyUser = await userRepository.findOne({ where: { id: user.id } });
    if (verifyUser) {
      console.log('✅ Verification - User privileges updated in database');
    }

  } catch (error) {
    console.error('❌ Error granting admin access:', error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: GrantAdminOptions = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--wallet' && args[i + 1]) {
    options.walletAddress = args[i + 1];
    i++;
  } else if (arg === '--email' && args[i + 1]) {
    options.email = args[i + 1];
    i++;
  } else if (arg === '--user-id' && args[i + 1]) {
    options.userId = args[i + 1];
    i++;
  } else if (arg === '--super') {
    options.super = true;
  } else if (arg === '--role' && args[i + 1]) {
    options.role = args[i + 1] as 'admin' | 'owner';
    i++;
  }
}

// Validate arguments
if (!options.walletAddress && !options.email && !options.userId) {
  console.error('❌ Error: Must provide --wallet, --email, or --user-id');
  console.log('Usage: npx ts-node scripts/grant-admin-access.ts [options]');
  console.log('Options:');
  console.log('  --wallet <address>    Wallet address of user');
  console.log('  --email <email>       Email of user');
  console.log('  --user-id <id>        User ID');
  console.log('  --super               Grant super admin privileges');
  console.log('  --role <role>         Specific role (admin|owner)');
  console.log('');
  console.log('Examples:');
  console.log('  npx ts-node scripts/grant-admin-access.ts --wallet 0xeDeF23d5ee863a34df67E345C64E99d52B07421D --super');
  console.log('  npx ts-node scripts/grant-admin-access.ts --email admin@test.com --role owner');
  process.exit(1);
}

// Run the script
console.log('🚀 Starting admin access grant script...');
grantAdminAccess(options);