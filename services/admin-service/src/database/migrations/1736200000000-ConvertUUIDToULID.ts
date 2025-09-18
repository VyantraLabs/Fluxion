import { MigrationInterface, QueryRunner } from 'typeorm';
import { ulid } from 'ulid';

export class ConvertUUIDToULID1736200000000 implements MigrationInterface {
  name = 'ConvertUUIDToULID1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // This migration converts all UUID primary keys and foreign keys to ULIDs
    // WARNING: This is a destructive operation and should be run in maintenance mode
    // TEMPORARILY DISABLED - ULID conversion is already handled by entity @BeforeInsert hooks
    console.log('Skipping UUID to ULID migration - handled by entity hooks');
    return;
    
    console.log('Starting UUID to ULID migration...');
    
    // Create a mapping table for UUID to ULID conversion
    await queryRunner.query(`CREATE TEMPORARY TABLE uuid_ulid_mapping (
      uuid_value UUID PRIMARY KEY,
      ulid_value VARCHAR(26) NOT NULL UNIQUE
    )`);

    // Step 1: Collect all existing UUIDs and generate corresponding ULIDs
    console.log('Collecting existing UUIDs...');
    
    // Organizations
    const orgs = await queryRunner.query('SELECT id FROM organizations');
    for (const org of orgs) {
      const newId = ulid();
      await queryRunner.query(
        'INSERT INTO uuid_ulid_mapping (uuid_value, ulid_value) VALUES ($1, $2)',
        [org.id, newId]
      );
    }

    // Users
    const users = await queryRunner.query('SELECT id FROM users');
    for (const user of users) {
      const newId = ulid();
      await queryRunner.query(
        'INSERT INTO uuid_ulid_mapping (uuid_value, ulid_value) VALUES ($1, $2)',
        [user.id, newId]
      );
    }

    // Blockchain Networks
    const networks = await queryRunner.query('SELECT id FROM blockchain_networks');
    for (const network of networks) {
      const newId = ulid();
      await queryRunner.query(
        'INSERT INTO uuid_ulid_mapping (uuid_value, ulid_value) VALUES ($1, $2)',
        [network.id, newId]
      );
    }

    // Tokens
    const tokens = await queryRunner.query('SELECT id FROM tokens');
    for (const token of tokens) {
      const newId = ulid();
      await queryRunner.query(
        'INSERT INTO uuid_ulid_mapping (uuid_value, ulid_value) VALUES ($1, $2)',
        [token.id, newId]
      );
    }

    // Invoices
    const invoices = await queryRunner.query('SELECT id FROM invoices');
    for (const invoice of invoices) {
      const newId = ulid();
      await queryRunner.query(
        'INSERT INTO uuid_ulid_mapping (uuid_value, ulid_value) VALUES ($1, $2)',
        [invoice.id, newId]
      );
    }

    // Other entities (if they exist)
    try {
      const payments = await queryRunner.query('SELECT id FROM payments');
      for (const payment of payments) {
        const newId = ulid();
        await queryRunner.query(
          'INSERT INTO uuid_ulid_mapping (uuid_value, ulid_value) VALUES ($1, $2)',
          [payment.id, newId]
        );
      }
    } catch (e) {
      console.log('Payments table does not exist yet');
    }

    console.log('UUID to ULID mapping complete. Starting schema updates...');

    // Step 2: Disable foreign key constraints temporarily
    await queryRunner.query('SET session_replication_role = replica');

    // Step 3: Update organizations table
    console.log('Updating organizations table...');
    await queryRunner.query(`ALTER TABLE organizations 
      ALTER COLUMN id TYPE VARCHAR(26) USING (
        SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = organizations.id::UUID
      )`);

    // Step 4: Update users table
    console.log('Updating users table...');
    await queryRunner.query(`ALTER TABLE users 
      ALTER COLUMN id TYPE VARCHAR(26) USING (
        SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = users.id::UUID
      )`);
    
    await queryRunner.query(`ALTER TABLE users 
      ALTER COLUMN organization_id TYPE VARCHAR(26) USING (
        SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = users.organization_id::UUID
      )`);

    // Step 5: Update blockchain_networks table (if exists)
    try {
      console.log('Updating blockchain_networks table...');
      await queryRunner.query(`ALTER TABLE blockchain_networks 
        ALTER COLUMN id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = blockchain_networks.id::UUID
        )`);
    } catch (e) {
      console.log('blockchain_networks table does not exist');
    }

    // Step 6: Update tokens table (if exists)
    try {
      console.log('Updating tokens table...');
      await queryRunner.query(`ALTER TABLE tokens 
        ALTER COLUMN id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = tokens.id::UUID
        )`);
      
      // Update network_id foreign key
      await queryRunner.query(`ALTER TABLE tokens 
        ALTER COLUMN network_id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = tokens.network_id::UUID
        )`);
    } catch (e) {
      console.log('tokens table does not exist');
    }

    // Step 7: Update invoices table
    console.log('Updating invoices table...');
    await queryRunner.query(`ALTER TABLE invoices 
      ALTER COLUMN id TYPE VARCHAR(26) USING (
        SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = invoices.id::UUID
      )`);
    
    await queryRunner.query(`ALTER TABLE invoices 
      ALTER COLUMN organization_id TYPE VARCHAR(26) USING (
        SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = invoices.organization_id::UUID
      )`);
    
    await queryRunner.query(`ALTER TABLE invoices 
      ALTER COLUMN created_by TYPE VARCHAR(26) USING (
        SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = invoices.created_by::UUID
      )`);

    // Update network_id and token_id foreign keys if they exist
    try {
      await queryRunner.query(`ALTER TABLE invoices 
        ALTER COLUMN network_id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = invoices.network_id::UUID
        )`);
      
      await queryRunner.query(`ALTER TABLE invoices 
        ALTER COLUMN token_id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = invoices.token_id::UUID
        )`);
    } catch (e) {
      console.log('Some invoice foreign key columns do not exist yet');
    }

    // Step 8: Update other tables if they exist
    try {
      console.log('Updating payments table...');
      await queryRunner.query(`ALTER TABLE payments 
        ALTER COLUMN id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = payments.id::UUID
        )`);
      
      await queryRunner.query(`ALTER TABLE payments 
        ALTER COLUMN organization_id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = payments.organization_id::UUID
        )`);
      
      await queryRunner.query(`ALTER TABLE payments 
        ALTER COLUMN invoice_id TYPE VARCHAR(26) USING (
          SELECT ulid_value FROM uuid_ulid_mapping WHERE uuid_value = payments.invoice_id::UUID
        )`);
    } catch (e) {
      console.log('payments table does not exist yet');
    }

    // Step 9: Re-enable foreign key constraints
    await queryRunner.query('SET session_replication_role = DEFAULT');

    // Step 10: Clean up mapping table
    await queryRunner.query('DROP TABLE uuid_ulid_mapping');

    console.log('UUID to ULID migration completed successfully!');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // This migration cannot be easily reversed as ULIDs cannot be converted back to UUIDs
    // You would need to restore from a backup made before this migration
    throw new Error(
      'Cannot reverse UUID to ULID migration. Restore from backup if rollback is needed.'
    );
  }
}