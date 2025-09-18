import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReminderJobsTable1736800000000 implements MigrationInterface {
    name = 'CreateReminderJobsTable1736800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create reminder_jobs table
        await queryRunner.query(`
            CREATE TABLE "reminder_jobs" (
                "id" varchar PRIMARY KEY DEFAULT generate_ulid(),
                "organization_id" varchar NOT NULL,
                "invoice_id" varchar NOT NULL,
                "user_id" varchar,
                "type" varchar(20) NOT NULL,
                "status" varchar(20) NOT NULL DEFAULT 'scheduled',
                "priority" varchar(10) NOT NULL DEFAULT 'normal',
                "scheduled_for" timestamptz NOT NULL,
                "sent_at" timestamptz,
                "occurrence_count" integer NOT NULL DEFAULT 0,
                "max_occurrences" integer,
                "retry_count" integer NOT NULL DEFAULT 0,
                "max_retries" integer NOT NULL DEFAULT 3,
                "next_retry_at" timestamptz,
                "configuration" jsonb NOT NULL DEFAULT '{}',
                "notification_id" varchar,
                "error_message" text,
                "error_code" varchar(50),
                "metadata" jsonb NOT NULL DEFAULT '{}',
                "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT "scheduled_for_valid" CHECK (scheduled_for >= created_at),
                CONSTRAINT "occurrence_count_positive" CHECK (occurrence_count >= 0),
                CONSTRAINT "max_occurrences_positive" CHECK (max_occurrences IS NULL OR max_occurrences > 0),
                CONSTRAINT "retry_count_positive" CHECK (retry_count >= 0),
                CONSTRAINT "type_valid" CHECK (type IN ('due_date', 'overdue', 'payment_pending', 'custom')),
                CONSTRAINT "status_valid" CHECK (status IN ('scheduled', 'pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped')),
                CONSTRAINT "priority_valid" CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
            )
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_organization_id" ON "reminder_jobs" ("organization_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_invoice_id" ON "reminder_jobs" ("invoice_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_user_id" ON "reminder_jobs" ("user_id")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_type" ON "reminder_jobs" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_status" ON "reminder_jobs" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_priority" ON "reminder_jobs" ("priority")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_scheduled_for" ON "reminder_jobs" ("scheduled_for")`);

        // Composite indexes for common queries
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_org_status" ON "reminder_jobs" ("organization_id", "status")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_status_scheduled" ON "reminder_jobs" ("status", "scheduled_for")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_invoice_type" ON "reminder_jobs" ("invoice_id", "type")`);
        await queryRunner.query(`CREATE INDEX "IDX_reminder_jobs_priority_created" ON "reminder_jobs" ("priority", "created_at")`);

        // Partial index for due reminders (performance optimization for job processing)
        await queryRunner.query(`
            CREATE INDEX "IDX_reminder_jobs_due_processing"
            ON "reminder_jobs" ("scheduled_for", "priority") 
            WHERE "status" IN ('scheduled', 'pending')
        `);

        // Partial index for scheduled reminders (without NOW() constraint)
        await queryRunner.query(`
            CREATE INDEX "IDX_reminder_jobs_scheduled_only"
            ON "reminder_jobs" ("scheduled_for") 
            WHERE "status" = 'scheduled'
        `);

        // Create foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "reminder_jobs" 
            ADD CONSTRAINT "FK_reminder_jobs_organization" 
            FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "reminder_jobs" 
            ADD CONSTRAINT "FK_reminder_jobs_invoice" 
            FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE
        `);

        await queryRunner.query(`
            ALTER TABLE "reminder_jobs" 
            ADD CONSTRAINT "FK_reminder_jobs_user" 
            FOREIGN KEY ("user_id") REFERENCES "users"("id") 
            ON DELETE SET NULL ON UPDATE CASCADE
        `);

        // Add trigger to auto-update updated_at column
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_reminder_jobs_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);

        await queryRunner.query(`
            CREATE TRIGGER trigger_update_reminder_jobs_updated_at
                BEFORE UPDATE ON reminder_jobs
                FOR EACH ROW
                EXECUTE FUNCTION update_reminder_jobs_updated_at();
        `);

        // Create a view for active reminders (performance optimization)
        await queryRunner.query(`
            CREATE VIEW active_reminder_jobs AS
            SELECT 
                rj.*,
                i.invoice_number,
                i.title as invoice_title,
                i.amount as invoice_amount,
                i.due_date as invoice_due_date,
                i.status as invoice_status,
                i.client_email,
                i.client_name,
                org.name as organization_name,
                u.wallet_address as creator_wallet
            FROM reminder_jobs rj
            LEFT JOIN invoices i ON rj.invoice_id = i.id
            LEFT JOIN organizations org ON rj.organization_id = org.id
            LEFT JOIN users u ON rj.user_id = u.id
            WHERE rj.status IN ('scheduled', 'pending', 'processing')
                AND rj.scheduled_for <= (CURRENT_TIMESTAMP + INTERVAL '1 day');
        `);

        console.log("✅ Created reminder_jobs table with indexes, constraints, and optimizations");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop the view
        await queryRunner.query(`DROP VIEW IF EXISTS active_reminder_jobs`);

        // Drop the trigger and function
        await queryRunner.query(`DROP TRIGGER IF EXISTS trigger_update_reminder_jobs_updated_at ON reminder_jobs`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS update_reminder_jobs_updated_at()`);

        // Drop the table (foreign keys and indexes will be dropped automatically)
        await queryRunner.query(`DROP TABLE IF EXISTS "reminder_jobs"`);

        console.log("✅ Dropped reminder_jobs table and related objects");
    }
}