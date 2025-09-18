import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateNetworkSchemaUseChainIdAsPK1736300000000 implements MigrationInterface {
  name = 'UpdateNetworkSchemaUseChainIdAsPK1736300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Starting blockchain network schema update - using chain_id as primary key...');

    // Step 1: Check if blockchain_networks table exists
    const hasTable = await queryRunner.hasTable('blockchain_networks');
    if (!hasTable) {
      console.log('blockchain_networks table does not exist, skipping...');
      return;
    }

    // Step 2: Create a backup mapping of current network references
    console.log('Creating temporary mapping table for network references...');
    await queryRunner.query(`
      CREATE TEMPORARY TABLE network_chain_mapping AS
      SELECT id, chain_id FROM blockchain_networks
    `);

    // Step 3: Update tokens table to reference chain_id instead of network_id
    console.log('Updating tokens table schema...');
    
    // Add new chain_id column to tokens
    const hasTokensTable = await queryRunner.hasTable('tokens');
    if (hasTokensTable) {
      // Add chain_id column
      await queryRunner.query(`
        ALTER TABLE tokens ADD COLUMN chain_id INTEGER
      `);
      
      // Populate chain_id from current network_id references
      await queryRunner.query(`
        UPDATE tokens 
        SET chain_id = (
          SELECT bn.chain_id 
          FROM blockchain_networks bn 
          WHERE bn.id = tokens.network_id
        )
      `);
      
      // Drop old network_id column and constraints
      await queryRunner.query(`ALTER TABLE tokens DROP CONSTRAINT IF EXISTS "FK_tokens_network_id"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tokens_network_id"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tokens_contract_address_network_id"`);
      await queryRunner.query(`ALTER TABLE tokens DROP COLUMN network_id`);
      
      // Add new constraints and indexes
      await queryRunner.query(`ALTER TABLE tokens ALTER COLUMN chain_id SET NOT NULL`);
      await queryRunner.query(`CREATE INDEX "IDX_tokens_chain_id" ON tokens (chain_id)`);
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_tokens_contract_address_chain_id" ON tokens (contract_address, chain_id)`);
      
      // Add foreign key constraint
      await queryRunner.query(`
        ALTER TABLE tokens 
        ADD CONSTRAINT "FK_tokens_chain_id" 
        FOREIGN KEY (chain_id) REFERENCES blockchain_networks(chain_id) 
        ON DELETE CASCADE
      `);
    }

    // Step 4: Update invoices table to reference chain_id instead of network_id
    console.log('Updating invoices table schema...');
    const hasInvoicesTable = await queryRunner.hasTable('invoices');
    if (hasInvoicesTable) {
      // Add chain_id column
      await queryRunner.query(`
        ALTER TABLE invoices ADD COLUMN chain_id INTEGER
      `);
      
      // Populate chain_id from current network_id references
      await queryRunner.query(`
        UPDATE invoices 
        SET chain_id = (
          SELECT bn.chain_id 
          FROM blockchain_networks bn 
          WHERE bn.id = invoices.network_id::UUID
        )
      `);
      
      // Drop old network_id column and constraints
      await queryRunner.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS "FK_invoices_network_id"`);
      await queryRunner.query(`DROP INDEX IF EXISTS "IDX_invoices_network_id"`);
      await queryRunner.query(`ALTER TABLE invoices DROP COLUMN network_id`);
      
      // Add new constraints and indexes
      await queryRunner.query(`ALTER TABLE invoices ALTER COLUMN chain_id SET NOT NULL`);
      await queryRunner.query(`CREATE INDEX "IDX_invoices_chain_id" ON invoices (chain_id)`);
      
      // Add foreign key constraint
      await queryRunner.query(`
        ALTER TABLE invoices 
        ADD CONSTRAINT "FK_invoices_chain_id" 
        FOREIGN KEY (chain_id) REFERENCES blockchain_networks(chain_id) 
        ON DELETE RESTRICT
      `);
    }

    // Step 5: Update invoice_templates table
    console.log('Updating invoice_templates table schema...');
    const hasTemplatesTable = await queryRunner.hasTable('invoice_templates');
    if (hasTemplatesTable) {
      // Add default_chain_id column
      await queryRunner.query(`
        ALTER TABLE invoice_templates ADD COLUMN default_chain_id INTEGER
      `);
      
      // Populate default_chain_id from current default_network_id references
      await queryRunner.query(`
        UPDATE invoice_templates 
        SET default_chain_id = (
          SELECT bn.chain_id 
          FROM blockchain_networks bn 
          WHERE bn.id = invoice_templates.default_network_id
        )
        WHERE default_network_id IS NOT NULL
      `);
      
      // Drop old default_network_id column and constraints
      await queryRunner.query(`ALTER TABLE invoice_templates DROP CONSTRAINT IF EXISTS "FK_invoice_templates_default_network_id"`);
      await queryRunner.query(`ALTER TABLE invoice_templates DROP COLUMN default_network_id`);
      
      // Add foreign key constraint for default_chain_id
      await queryRunner.query(`
        ALTER TABLE invoice_templates 
        ADD CONSTRAINT "FK_invoice_templates_default_chain_id" 
        FOREIGN KEY (default_chain_id) REFERENCES blockchain_networks(chain_id) 
        ON DELETE SET NULL
      `);
    }

    // Step 6: Update other tables that reference network_id
    const tablesToUpdate = [
      'payments',
      'payment_verification_jobs', 
      'smart_contracts',
      'payroll_batches'
    ];

    for (const tableName of tablesToUpdate) {
      const hasOtherTable = await queryRunner.hasTable(tableName);
      if (hasOtherTable) {
        console.log(`Updating ${tableName} table schema...`);
        
        // Add chain_id column
        await queryRunner.query(`
          ALTER TABLE ${tableName} ADD COLUMN chain_id INTEGER
        `);
        
        // Populate chain_id from network_id
        await queryRunner.query(`
          UPDATE ${tableName} 
          SET chain_id = (
            SELECT bn.chain_id 
            FROM blockchain_networks bn 
            WHERE bn.id = ${tableName}.network_id
          )
        `);
        
        // Drop old constraints and columns
        await queryRunner.query(`ALTER TABLE ${tableName} DROP CONSTRAINT IF EXISTS "FK_${tableName}_network_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_${tableName}_network_id"`);
        await queryRunner.query(`ALTER TABLE ${tableName} DROP COLUMN network_id`);
        
        // Add new constraints
        await queryRunner.query(`ALTER TABLE ${tableName} ALTER COLUMN chain_id SET NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_${tableName}_chain_id" ON ${tableName} (chain_id)`);
        await queryRunner.query(`
          ALTER TABLE ${tableName} 
          ADD CONSTRAINT "FK_${tableName}_chain_id" 
          FOREIGN KEY (chain_id) REFERENCES blockchain_networks(chain_id) 
          ON DELETE CASCADE
        `);
      }
    }

    // Step 7: Update blockchain_networks table to use chain_id as primary key
    console.log('Updating blockchain_networks primary key...');
    
    // Drop existing constraints on the id column
    await queryRunner.query(`ALTER TABLE blockchain_networks DROP CONSTRAINT IF EXISTS "PK_blockchain_networks"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_blockchain_networks_chain_id"`);
    
    // Remove the old id column
    await queryRunner.query(`ALTER TABLE blockchain_networks DROP COLUMN id`);
    
    // Add primary key constraint on chain_id
    await queryRunner.query(`ALTER TABLE blockchain_networks ADD CONSTRAINT "PK_blockchain_networks" PRIMARY KEY (chain_id)`);
    
    // Clean up temporary table
    await queryRunner.query(`DROP TABLE IF EXISTS network_chain_mapping`);

    console.log('Blockchain network schema update completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Rolling back blockchain network schema changes...');

    // This migration is complex to reverse, but we'll provide basic rollback
    // Add back id column to blockchain_networks
    const hasTable = await queryRunner.hasTable('blockchain_networks');
    if (hasTable) {
      await queryRunner.query(`ALTER TABLE blockchain_networks ADD COLUMN id UUID DEFAULT gen_random_uuid()`);
      await queryRunner.query(`ALTER TABLE blockchain_networks DROP CONSTRAINT "PK_blockchain_networks"`);
      await queryRunner.query(`ALTER TABLE blockchain_networks ADD CONSTRAINT "PK_blockchain_networks" PRIMARY KEY (id)`);
      await queryRunner.query(`CREATE UNIQUE INDEX "IDX_blockchain_networks_chain_id" ON blockchain_networks (chain_id)`);
    }

    // Note: Reversing foreign key relationships would require more complex logic
    // In a production environment, you would typically restore from backup
    console.log('Partial rollback completed. Full rollback requires database restore from backup.');
  }
}