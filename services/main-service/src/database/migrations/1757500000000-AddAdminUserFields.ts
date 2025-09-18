import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdminUserFields1757500000000 implements MigrationInterface {
    name = 'AddAdminUserFields1757500000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add admin-related columns to users table
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD COLUMN "is_admin" boolean NOT NULL DEFAULT false,
            ADD COLUMN "is_super_admin" boolean NOT NULL DEFAULT false,
            ADD COLUMN "admin_granted_at" TIMESTAMP WITH TIME ZONE,
            ADD COLUMN "admin_granted_by" varchar(255)
        `);

        // Create index on admin fields for performance
        await queryRunner.query(`
            CREATE INDEX "IDX_users_is_admin" ON "users" ("is_admin") 
            WHERE "is_admin" = true
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_users_is_super_admin" ON "users" ("is_super_admin") 
            WHERE "is_super_admin" = true
        `);

        // Add constraint to ensure super admins are also admins
        await queryRunner.query(`
            ALTER TABLE "users" 
            ADD CONSTRAINT "CHK_super_admin_is_admin" 
            CHECK ("is_super_admin" = false OR "is_admin" = true)
        `);

        // Enhance audit_logs table for admin tracking
        await queryRunner.query(`
            ALTER TABLE "audit_logs" 
            ADD COLUMN "admin_action" boolean NOT NULL DEFAULT false,
            ADD COLUMN "admin_user_id" varchar(255),
            ADD COLUMN "severity_level" varchar(20) DEFAULT 'low'
        `);

        // Create indexes for audit log admin tracking
        await queryRunner.query(`
            CREATE INDEX "IDX_audit_logs_admin_action" ON "audit_logs" ("admin_action") 
            WHERE "admin_action" = true
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_audit_logs_admin_user_id" ON "audit_logs" ("admin_user_id") 
            WHERE "admin_user_id" IS NOT NULL
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_audit_logs_severity_level" ON "audit_logs" ("severity_level")
        `);

        // Add foreign key constraint for admin_user_id
        await queryRunner.query(`
            ALTER TABLE "audit_logs" 
            ADD CONSTRAINT "FK_audit_logs_admin_user" 
            FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") 
            ON DELETE SET NULL
        `);

        // Create system_settings table for global configuration
        await queryRunner.query(`
            CREATE TABLE "system_settings" (
                "id" varchar(255) PRIMARY KEY,
                "key" varchar(255) NOT NULL UNIQUE,
                "value" jsonb NOT NULL,
                "category" varchar(100) NOT NULL DEFAULT 'general',
                "description" text,
                "is_public" boolean NOT NULL DEFAULT false,
                "is_encrypted" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_by" varchar(255)
            )
        `);

        // Add indexes for system_settings
        await queryRunner.query(`
            CREATE INDEX "IDX_system_settings_key" ON "system_settings" ("key")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_system_settings_category" ON "system_settings" ("category")
        `);

        await queryRunner.query(`
            CREATE INDEX "IDX_system_settings_is_public" ON "system_settings" ("is_public")
        `);

        // Add foreign key for updated_by
        await queryRunner.query(`
            ALTER TABLE "system_settings" 
            ADD CONSTRAINT "FK_system_settings_updated_by" 
            FOREIGN KEY ("updated_by") REFERENCES "users"("id") 
            ON DELETE SET NULL
        `);

        // Insert initial system settings
        await queryRunner.query(`
            INSERT INTO "system_settings" ("id", "key", "value", "category", "description", "is_public") VALUES 
            ('settings_001_maintenance', 'maintenance_mode', 'false', 'system', 'Enable/disable system maintenance mode', false),
            ('settings_002_upload_size', 'max_file_upload_size', '10485760', 'limits', 'Maximum file upload size in bytes (10MB)', true),
            ('settings_003_session_timeout', 'session_timeout_hours', '24', 'security', 'JWT session timeout in hours', true),
            ('settings_004_rate_limit', 'rate_limit_requests_per_minute', '60', 'security', 'API rate limit per IP per minute', false),
            ('settings_005_email_notif', 'email_notifications_enabled', 'true', 'notifications', 'Enable/disable email notifications', true),
            ('settings_006_webhook_notif', 'webhook_notifications_enabled', 'true', 'notifications', 'Enable/disable webhook notifications', true)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop system_settings table
        await queryRunner.query(`DROP TABLE "system_settings"`);

        // Remove audit_logs enhancements
        await queryRunner.query(`
            ALTER TABLE "audit_logs" 
            DROP CONSTRAINT IF EXISTS "FK_audit_logs_admin_user"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_audit_logs_admin_action"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_audit_logs_admin_user_id"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_audit_logs_severity_level"
        `);

        await queryRunner.query(`
            ALTER TABLE "audit_logs" 
            DROP COLUMN IF EXISTS "admin_action",
            DROP COLUMN IF EXISTS "admin_user_id",
            DROP COLUMN IF EXISTS "severity_level"
        `);

        // Remove user admin fields
        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP CONSTRAINT IF EXISTS "CHK_super_admin_is_admin"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_users_is_admin"
        `);

        await queryRunner.query(`
            DROP INDEX IF EXISTS "IDX_users_is_super_admin"
        `);

        await queryRunner.query(`
            ALTER TABLE "users" 
            DROP COLUMN IF EXISTS "is_admin",
            DROP COLUMN IF EXISTS "is_super_admin",
            DROP COLUMN IF EXISTS "admin_granted_at",
            DROP COLUMN IF EXISTS "admin_granted_by"
        `);
    }
}