import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1704000000000 implements MigrationInterface {
  name = 'InitialSchema1704000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable necessary extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // Create organizations table
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "slug" character varying(100) NOT NULL,
        "plan" character varying(50) NOT NULL DEFAULT 'basic',
        "settings" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizations_slug" UNIQUE ("slug"),
        CONSTRAINT "organizations_slug_format" CHECK (slug ~* '^[a-z0-9-]+$')
      )
    `);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "email" character varying(320) NOT NULL,
        "wallet_address" character varying(42),
        "first_name" character varying(100),
        "last_name" character varying(100),
        "role" character varying(50) NOT NULL DEFAULT 'member',
        "is_active" boolean NOT NULL DEFAULT true,
        "email_verified" boolean NOT NULL DEFAULT false,
        "last_login_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"),
        CONSTRAINT "users_email_org_unique" UNIQUE ("email", "organization_id"),
        CONSTRAINT "users_wallet_format" CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$' OR wallet_address IS NULL)
      )
    `);

    // Create blockchain_networks table
    await queryRunner.query(`
      CREATE TABLE "blockchain_networks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "chain_id" integer NOT NULL,
        "name" character varying(100) NOT NULL,
        "symbol" character varying(10) NOT NULL,
        "rpc_url" character varying(500) NOT NULL,
        "explorer_url" character varying(500),
        "is_testnet" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "gas_settings" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_blockchain_networks" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_blockchain_networks_chain_id" UNIQUE ("chain_id")
      )
    `);

    // Create tokens table
    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "network_id" uuid NOT NULL,
        "contract_address" character varying(42),
        "symbol" character varying(20) NOT NULL,
        "name" character varying(100) NOT NULL,
        "decimals" integer NOT NULL DEFAULT 18,
        "is_native" boolean NOT NULL DEFAULT false,
        "is_stablecoin" boolean NOT NULL DEFAULT false,
        "logo_url" character varying(500),
        "price_feed_id" character varying(100),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "tokens_address_network_unique" UNIQUE ("contract_address", "network_id"),
        CONSTRAINT "tokens_native_address" CHECK (
          (is_native = true AND contract_address IS NULL) OR 
          (is_native = false AND contract_address IS NOT NULL)
        )
      )
    `);

    // Create smart_contracts table
    await queryRunner.query(`
      CREATE TABLE "smart_contracts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "network_id" uuid NOT NULL,
        "contract_address" character varying(42) NOT NULL,
        "contract_type" character varying(50) NOT NULL,
        "abi" jsonb NOT NULL,
        "version" character varying(20) NOT NULL DEFAULT '1.0.0',
        "is_active" boolean NOT NULL DEFAULT true,
        "deployed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_smart_contracts" PRIMARY KEY ("id"),
        CONSTRAINT "contracts_address_network_unique" UNIQUE ("contract_address", "network_id")
      )
    `);

    // Create invoices table
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "created_by" uuid NOT NULL,
        "invoice_number" character varying(50) NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "due_date" date,
        "client_name" character varying(255),
        "client_email" character varying(320),
        "client_wallet" character varying(42),
        "network_id" uuid NOT NULL,
        "token_id" uuid NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "amount_paid" decimal(36,18) NOT NULL DEFAULT '0',
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "paid_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id"),
        CONSTRAINT "invoices_number_org_unique" UNIQUE ("invoice_number", "organization_id"),
        CONSTRAINT "invoices_amount_positive" CHECK (amount > 0),
        CONSTRAINT "invoices_client_wallet_format" CHECK (client_wallet ~* '^0x[a-fA-F0-9]{40}$' OR client_wallet IS NULL),
        CONSTRAINT "invoices_status_valid" CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'))
      )
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "invoice_id" uuid,
        "tx_hash" character varying(66) NOT NULL,
        "network_id" uuid NOT NULL,
        "token_id" uuid NOT NULL,
        "from_address" character varying(42) NOT NULL,
        "to_address" character varying(42) NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "gas_used" bigint,
        "gas_price" decimal(36,18),
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "block_number" bigint,
        "confirmations" integer NOT NULL DEFAULT 0,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "confirmed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_payments" PRIMARY KEY ("id"),
        CONSTRAINT "payments_tx_network_unique" UNIQUE ("tx_hash", "network_id"),
        CONSTRAINT "payments_amount_positive" CHECK (amount > 0),
        CONSTRAINT "payments_status_valid" CHECK (status IN ('pending', 'confirmed', 'failed'))
      )
    `);

    // Create payroll_batches table
    await queryRunner.query(`
      CREATE TABLE "payroll_batches" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "created_by" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text,
        "network_id" uuid NOT NULL,
        "token_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'draft',
        "total_amount" decimal(36,18) NOT NULL DEFAULT '0',
        "recipients_count" integer NOT NULL DEFAULT 0,
        "successful_count" integer NOT NULL DEFAULT 0,
        "failed_count" integer NOT NULL DEFAULT 0,
        "tx_hash" character varying(66),
        "gas_used" bigint,
        "gas_price" decimal(36,18),
        "block_number" bigint,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "executed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_batches" PRIMARY KEY ("id"),
        CONSTRAINT "payroll_status_valid" CHECK (status IN ('draft', 'processing', 'completed', 'failed', 'partially_completed'))
      )
    `);

    // Create payroll_recipients table
    await queryRunner.query(`
      CREATE TABLE "payroll_recipients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "batch_id" uuid NOT NULL,
        "name" character varying(255) NOT NULL,
        "wallet_address" character varying(42) NOT NULL,
        "amount" decimal(36,18) NOT NULL,
        "email" character varying(320),
        "employee_id" character varying(100),
        "department" character varying(100),
        "position" character varying(100),
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "tx_hash" character varying(66),
        "gas_used" bigint,
        "gas_price" decimal(36,18),
        "error_message" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "sent_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payroll_recipients" PRIMARY KEY ("id"),
        CONSTRAINT "payroll_recipients_amount_positive" CHECK (amount > 0),
        CONSTRAINT "payroll_recipients_wallet_format" CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$'),
        CONSTRAINT "payroll_recipients_status_valid" CHECK (status IN ('pending', 'sent', 'failed'))
      )
    `);

    // Create organization_settings table
    await queryRunner.query(`
      CREATE TABLE "organization_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "setting_key" character varying(100) NOT NULL,
        "setting_value" jsonb NOT NULL,
        "is_encrypted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_settings" PRIMARY KEY ("id"),
        CONSTRAINT "org_settings_unique" UNIQUE ("organization_id", "setting_key")
      )
    `);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "user_id" uuid,
        "table_name" character varying(100) NOT NULL,
        "record_id" uuid NOT NULL,
        "action" character varying(20) NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "ip_address" inet,
        "user_agent" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id"),
        CONSTRAINT "audit_action_valid" CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'))
      )
    `);

    // Create foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD CONSTRAINT "FK_users_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tokens" 
      ADD CONSTRAINT "FK_tokens_network_id" 
      FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "smart_contracts" 
      ADD CONSTRAINT "FK_smart_contracts_network_id" 
      FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_created_by" 
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_network_id" 
      FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "invoices" 
      ADD CONSTRAINT "FK_invoices_token_id" 
      FOREIGN KEY ("token_id") REFERENCES "tokens"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_invoice_id" 
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_network_id" 
      FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_token_id" 
      FOREIGN KEY ("token_id") REFERENCES "tokens"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "payroll_batches" 
      ADD CONSTRAINT "FK_payroll_batches_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "payroll_batches" 
      ADD CONSTRAINT "FK_payroll_batches_created_by" 
      FOREIGN KEY ("created_by") REFERENCES "users"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "payroll_batches" 
      ADD CONSTRAINT "FK_payroll_batches_network_id" 
      FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "payroll_batches" 
      ADD CONSTRAINT "FK_payroll_batches_token_id" 
      FOREIGN KEY ("token_id") REFERENCES "tokens"("id")
    `);

    await queryRunner.query(`
      ALTER TABLE "payroll_recipients" 
      ADD CONSTRAINT "FK_payroll_recipients_batch_id" 
      FOREIGN KEY ("batch_id") REFERENCES "payroll_batches"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "organization_settings" 
      ADD CONSTRAINT "FK_organization_settings_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "FK_audit_logs_organization_id" 
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "audit_logs" 
      ADD CONSTRAINT "FK_audit_logs_user_id" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // Create indexes for better performance
    await queryRunner.query(`CREATE INDEX "IDX_organizations_slug" ON "organizations" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_organization_id" ON "users" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_wallet_address" ON "users" ("wallet_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_blockchain_networks_chain_id" ON "blockchain_networks" ("chain_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_blockchain_networks_is_active" ON "blockchain_networks" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_tokens_network_id" ON "tokens" ("network_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tokens_symbol" ON "tokens" ("symbol")`);
    await queryRunner.query(`CREATE INDEX "IDX_tokens_is_active" ON "tokens" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_smart_contracts_network_id" ON "smart_contracts" ("network_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_smart_contracts_contract_type" ON "smart_contracts" ("contract_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_smart_contracts_is_active" ON "smart_contracts" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_organization_id" ON "invoices" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_created_by" ON "invoices" ("created_by")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_network_id" ON "invoices" ("network_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_token_id" ON "invoices" ("token_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_status" ON "invoices" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_due_date" ON "invoices" ("due_date")`);
    await queryRunner.query(`CREATE INDEX "IDX_invoices_client_email" ON "invoices" ("client_email")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_organization_id" ON "payments" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_invoice_id" ON "payments" ("invoice_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_network_id" ON "payments" ("network_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_token_id" ON "payments" ("token_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON "payments" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_from_address" ON "payments" ("from_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_to_address" ON "payments" ("to_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_block_number" ON "payments" ("block_number")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_batches_organization_id" ON "payroll_batches" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_batches_created_by" ON "payroll_batches" ("created_by")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_batches_network_id" ON "payroll_batches" ("network_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_batches_token_id" ON "payroll_batches" ("token_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_batches_status" ON "payroll_batches" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_batches_executed_at" ON "payroll_batches" ("executed_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_recipients_batch_id" ON "payroll_recipients" ("batch_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_recipients_wallet_address" ON "payroll_recipients" ("wallet_address")`);
    await queryRunner.query(`CREATE INDEX "IDX_payroll_recipients_status" ON "payroll_recipients" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_organization_settings_organization_id" ON "organization_settings" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_organization_settings_setting_key" ON "organization_settings" ("setting_key")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_organization_id" ON "audit_logs" ("organization_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_table_name" ON "audit_logs" ("table_name")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_record_id" ON "audit_logs" ("record_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_ip_address" ON "audit_logs" ("ip_address")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all indexes
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_ip_address"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_action"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_record_id"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_table_name"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_audit_logs_organization_id"`);
    await queryRunner.query(`DROP INDEX "IDX_organization_settings_setting_key"`);
    await queryRunner.query(`DROP INDEX "IDX_organization_settings_organization_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_recipients_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_recipients_wallet_address"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_recipients_batch_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_batches_executed_at"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_batches_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_batches_token_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_batches_network_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_batches_created_by"`);
    await queryRunner.query(`DROP INDEX "IDX_payroll_batches_organization_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_block_number"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_to_address"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_from_address"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_token_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_network_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_invoice_id"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_organization_id"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_client_email"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_due_date"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_status"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_token_id"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_network_id"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_created_by"`);
    await queryRunner.query(`DROP INDEX "IDX_invoices_organization_id"`);
    await queryRunner.query(`DROP INDEX "IDX_smart_contracts_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_smart_contracts_contract_type"`);
    await queryRunner.query(`DROP INDEX "IDX_smart_contracts_network_id"`);
    await queryRunner.query(`DROP INDEX "IDX_tokens_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_tokens_symbol"`);
    await queryRunner.query(`DROP INDEX "IDX_tokens_network_id"`);
    await queryRunner.query(`DROP INDEX "IDX_blockchain_networks_is_active"`);
    await queryRunner.query(`DROP INDEX "IDX_blockchain_networks_chain_id"`);
    await queryRunner.query(`DROP INDEX "IDX_users_wallet_address"`);
    await queryRunner.query(`DROP INDEX "IDX_users_organization_id"`);
    await queryRunner.query(`DROP INDEX "IDX_organizations_slug"`);

    // Drop all foreign key constraints
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_user_id"`);
    await queryRunner.query(`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_audit_logs_organization_id"`);
    await queryRunner.query(`ALTER TABLE "organization_settings" DROP CONSTRAINT "FK_organization_settings_organization_id"`);
    await queryRunner.query(`ALTER TABLE "payroll_recipients" DROP CONSTRAINT "FK_payroll_recipients_batch_id"`);
    await queryRunner.query(`ALTER TABLE "payroll_batches" DROP CONSTRAINT "FK_payroll_batches_token_id"`);
    await queryRunner.query(`ALTER TABLE "payroll_batches" DROP CONSTRAINT "FK_payroll_batches_network_id"`);
    await queryRunner.query(`ALTER TABLE "payroll_batches" DROP CONSTRAINT "FK_payroll_batches_created_by"`);
    await queryRunner.query(`ALTER TABLE "payroll_batches" DROP CONSTRAINT "FK_payroll_batches_organization_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_token_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_network_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_invoice_id"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_organization_id"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_token_id"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_network_id"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_created_by"`);
    await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_organization_id"`);
    await queryRunner.query(`ALTER TABLE "smart_contracts" DROP CONSTRAINT "FK_smart_contracts_network_id"`);
    await queryRunner.query(`ALTER TABLE "tokens" DROP CONSTRAINT "FK_tokens_network_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "FK_users_organization_id"`);

    // Drop all tables
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "organization_settings"`);
    await queryRunner.query(`DROP TABLE "payroll_recipients"`);
    await queryRunner.query(`DROP TABLE "payroll_batches"`);
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "smart_contracts"`);
    await queryRunner.query(`DROP TABLE "tokens"`);
    await queryRunner.query(`DROP TABLE "blockchain_networks"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "organizations"`);
  }
}