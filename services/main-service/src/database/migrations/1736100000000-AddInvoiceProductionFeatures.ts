import { MigrationInterface, QueryRunner } from "typeorm";

export class AddInvoiceProductionFeatures1736100000000 implements MigrationInterface {
    name = 'AddInvoiceProductionFeatures1736100000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create invoice_templates table
        await queryRunner.query(`
            CREATE TABLE "invoice_templates" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "organization_id" uuid NOT NULL,
                "created_by" uuid NOT NULL,
                "name" character varying(255) NOT NULL,
                "description" text,
                "default_title" character varying(255),
                "default_description" text,
                "default_due_days" integer NOT NULL DEFAULT 30,
                "default_network_id" uuid,
                "default_token_id" uuid,
                "configuration" jsonb NOT NULL DEFAULT '{}',
                "is_active" boolean NOT NULL DEFAULT true,
                "usage_count" integer NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_invoice_templates" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_template_name_org" UNIQUE ("name", "organization_id"),
                CONSTRAINT "FK_invoice_templates_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_invoice_templates_user" FOREIGN KEY ("created_by") REFERENCES "users"("id"),
                CONSTRAINT "FK_invoice_templates_network" FOREIGN KEY ("default_network_id") REFERENCES "blockchain_networks"("id"),
                CONSTRAINT "FK_invoice_templates_token" FOREIGN KEY ("default_token_id") REFERENCES "tokens"("id"),
                CONSTRAINT "name_length" CHECK (LENGTH(name) >= 1)
            )
        `);

        // Create invoice_access_tokens table
        await queryRunner.query(`
            CREATE TABLE "invoice_access_tokens" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "invoice_id" uuid NOT NULL,
                "token" character varying(64) NOT NULL,
                "client_email" character varying(320),
                "client_name" character varying(255),
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "last_accessed_at" TIMESTAMP WITH TIME ZONE,
                "last_accessed_ip" character varying(45),
                "access_count" integer NOT NULL DEFAULT 0,
                "max_access_count" integer NOT NULL DEFAULT 100,
                "is_active" boolean NOT NULL DEFAULT true,
                "created_by" character varying(255),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_invoice_access_tokens" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_access_token" UNIQUE ("token"),
                CONSTRAINT "FK_access_tokens_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE,
                CONSTRAINT "token_length" CHECK (LENGTH(token) = 64),
                CONSTRAINT "access_count_positive" CHECK (access_count >= 0),
                CONSTRAINT "expires_at_future" CHECK (expires_at > created_at)
            )
        `);

        // Create notification_queue table
        await queryRunner.query(`
            CREATE TABLE "notification_queue" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "organization_id" uuid NOT NULL,
                "invoice_id" uuid,
                "user_id" uuid,
                "type" character varying(50) NOT NULL,
                "recipient_email" character varying(320) NOT NULL,
                "recipient_name" character varying(255),
                "subject" character varying(255) NOT NULL,
                "email_template" character varying(100),
                "template_data" jsonb NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'pending',
                "priority" character varying(10) NOT NULL DEFAULT 'normal',
                "scheduled_for" TIMESTAMP WITH TIME ZONE NOT NULL,
                "sent_at" TIMESTAMP WITH TIME ZONE,
                "retry_count" integer NOT NULL DEFAULT 0,
                "max_retries" integer NOT NULL DEFAULT 3,
                "next_retry_at" TIMESTAMP WITH TIME ZONE,
                "error_message" text,
                "error_code" character varying(50),
                "provider_id" character varying(255),
                "provider_status" character varying(50),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notification_queue" PRIMARY KEY ("id"),
                CONSTRAINT "FK_notification_queue_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_notification_queue_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id"),
                CONSTRAINT "FK_notification_queue_user" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
                CONSTRAINT "retry_count_positive" CHECK (retry_count >= 0),
                CONSTRAINT "retry_count_max" CHECK (retry_count <= 10),
                CONSTRAINT "scheduled_for_valid" CHECK (scheduled_for >= created_at)
            )
        `);

        // Create notification_settings table
        await queryRunner.query(`
            CREATE TABLE "notification_settings" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "organization_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "email_settings" jsonb NOT NULL,
                "reminder_settings" jsonb NOT NULL,
                "template_settings" jsonb NOT NULL,
                "webhook_settings" jsonb NOT NULL DEFAULT '{}',
                "integration_settings" jsonb NOT NULL DEFAULT '{}',
                "global_unsubscribe" boolean NOT NULL DEFAULT false,
                "email_verified" boolean NOT NULL DEFAULT false,
                "email_verification_token" character varying(64),
                "email_verification_expires" TIMESTAMP WITH TIME ZONE,
                "preferred_language" character varying(10) NOT NULL DEFAULT 'en',
                "preferred_timezone" character varying(50) NOT NULL DEFAULT 'UTC',
                "last_notification_sent" TIMESTAMP WITH TIME ZONE,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_notification_settings" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_notification_settings_user_org" UNIQUE ("organization_id", "user_id"),
                CONSTRAINT "FK_notification_settings_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_notification_settings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
            )
        `);

        // Create payment_verification_jobs table
        await queryRunner.query(`
            CREATE TABLE "payment_verification_jobs" (
                "id" uuid NOT NULL DEFAULT gen_random_uuid(),
                "invoice_id" uuid NOT NULL,
                "network_id" uuid NOT NULL,
                "token_id" uuid,
                "tx_hash" character varying(66) NOT NULL,
                "from_address" character varying(42),
                "expected_amount" numeric(36,18) NOT NULL,
                "expected_recipient" character varying(42) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'pending',
                "priority" character varying(10) NOT NULL DEFAULT 'normal',
                "retry_count" integer NOT NULL DEFAULT 0,
                "max_retries" integer NOT NULL DEFAULT 10,
                "next_retry_at" TIMESTAMP WITH TIME ZONE,
                "started_at" TIMESTAMP WITH TIME ZONE,
                "completed_at" TIMESTAMP WITH TIME ZONE,
                "error_message" text,
                "error_code" character varying(50),
                "verification_data" jsonb,
                "verification_result" jsonb,
                "payment_id" uuid,
                "webhook_delivered" boolean NOT NULL DEFAULT false,
                "notification_sent" boolean NOT NULL DEFAULT false,
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_payment_verification_jobs" PRIMARY KEY ("id"),
                CONSTRAINT "FK_verification_jobs_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_verification_jobs_network" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id"),
                CONSTRAINT "FK_verification_jobs_token" FOREIGN KEY ("token_id") REFERENCES "tokens"("id"),
                CONSTRAINT "FK_verification_jobs_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id"),
                CONSTRAINT "retry_count_positive" CHECK (retry_count >= 0),
                CONSTRAINT "retry_count_max" CHECK (retry_count <= 20),
                CONSTRAINT "tx_hash_format" CHECK (tx_hash ~* '^0x[a-fA-F0-9]{64}$')
            )
        `);

        // Add new columns to invoices table
        await queryRunner.query(`
            ALTER TABLE "invoices" 
            ADD COLUMN "template_id" uuid,
            ADD COLUMN "client_settings" jsonb NOT NULL DEFAULT '{}',
            ADD COLUMN "qr_code_data" text,
            ADD COLUMN "mobile_payment_url" text
        `);

        // Add foreign key constraint for template_id
        await queryRunner.query(`
            ALTER TABLE "invoices" 
            ADD CONSTRAINT "FK_invoices_template" 
            FOREIGN KEY ("template_id") REFERENCES "invoice_templates"("id")
        `);

        // Create indexes for invoice_templates
        await queryRunner.query(`CREATE INDEX "IDX_invoice_templates_organization" ON "invoice_templates" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_templates_created_by" ON "invoice_templates" ("created_by")`);
        await queryRunner.query(`CREATE INDEX "IDX_invoice_templates_org_active" ON "invoice_templates" ("organization_id", "is_active")`);

        // Create indexes for invoice_access_tokens
        await queryRunner.query(`CREATE INDEX "IDX_access_tokens_invoice" ON "invoice_access_tokens" ("invoice_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_access_tokens_expires_at" ON "invoice_access_tokens" ("expires_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_access_tokens_invoice_token" ON "invoice_access_tokens" ("invoice_id", "token")`);

        // Create indexes for notification_queue
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_org" ON "notification_queue" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_invoice" ON "notification_queue" ("invoice_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_user" ON "notification_queue" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_type" ON "notification_queue" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_status" ON "notification_queue" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_priority" ON "notification_queue" ("priority")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_scheduled" ON "notification_queue" ("scheduled_for", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_queue_org_type" ON "notification_queue" ("organization_id", "type")`);

        // Create indexes for notification_settings
        await queryRunner.query(`CREATE INDEX "IDX_notification_settings_org" ON "notification_settings" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_notification_settings_user" ON "notification_settings" ("user_id")`);

        // Create indexes for payment_verification_jobs
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_invoice" ON "payment_verification_jobs" ("invoice_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_network" ON "payment_verification_jobs" ("network_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_tx_hash" ON "payment_verification_jobs" ("tx_hash")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_status" ON "payment_verification_jobs" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_priority" ON "payment_verification_jobs" ("priority")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_next_retry" ON "payment_verification_jobs" ("next_retry_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_status_retry" ON "payment_verification_jobs" ("status", "next_retry_at")`);
        await queryRunner.query(`CREATE INDEX "IDX_verification_jobs_priority_created" ON "payment_verification_jobs" ("priority", "created_at")`);

        // Create index for invoices template_id
        await queryRunner.query(`CREATE INDEX "IDX_invoices_template_id" ON "invoices" ("template_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop indexes first
        await queryRunner.query(`DROP INDEX "IDX_invoices_template_id"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_priority_created"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_status_retry"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_next_retry"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_priority"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_status"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_tx_hash"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_network"`);
        await queryRunner.query(`DROP INDEX "IDX_verification_jobs_invoice"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_settings_user"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_settings_org"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_org_type"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_scheduled"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_priority"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_status"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_type"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_user"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_invoice"`);
        await queryRunner.query(`DROP INDEX "IDX_notification_queue_org"`);
        await queryRunner.query(`DROP INDEX "IDX_access_tokens_invoice_token"`);
        await queryRunner.query(`DROP INDEX "IDX_access_tokens_expires_at"`);
        await queryRunner.query(`DROP INDEX "IDX_access_tokens_invoice"`);
        await queryRunner.query(`DROP INDEX "IDX_invoice_templates_org_active"`);
        await queryRunner.query(`DROP INDEX "IDX_invoice_templates_created_by"`);
        await queryRunner.query(`DROP INDEX "IDX_invoice_templates_organization"`);

        // Remove columns from invoices table
        await queryRunner.query(`ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_template"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "mobile_payment_url"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "qr_code_data"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "client_settings"`);
        await queryRunner.query(`ALTER TABLE "invoices" DROP COLUMN "template_id"`);

        // Drop tables in reverse dependency order
        await queryRunner.query(`DROP TABLE "payment_verification_jobs"`);
        await queryRunner.query(`DROP TABLE "notification_settings"`);
        await queryRunner.query(`DROP TABLE "notification_queue"`);
        await queryRunner.query(`DROP TABLE "invoice_access_tokens"`);
        await queryRunner.query(`DROP TABLE "invoice_templates"`);
    }
}