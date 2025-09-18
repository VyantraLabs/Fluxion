import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateInvoiceStatusValues1757190000000 implements MigrationInterface {
    name = 'UpdateInvoiceStatusValues1757190000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the existing status_valid constraint
        await queryRunner.query(`
            ALTER TABLE "invoices" 
            DROP CONSTRAINT IF EXISTS "status_valid"
        `);

        // Add the new status_valid constraint with all required values
        await queryRunner.query(`
            ALTER TABLE "invoices" 
            ADD CONSTRAINT "status_valid" 
            CHECK (status IN ('draft', 'created', 'initiated', 'sent', 'paid', 'overdue', 'cancelled', 'partial'))
        `);

        // Update the TypeScript enum comment for reference
        await queryRunner.query(`
            COMMENT ON COLUMN "invoices"."status" IS 'Invoice status: draft, created, initiated, sent, paid, overdue, cancelled, partial'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to the original constraint (keeping existing valid values)
        await queryRunner.query(`
            ALTER TABLE "invoices" 
            DROP CONSTRAINT IF EXISTS "status_valid"
        `);

        await queryRunner.query(`
            ALTER TABLE "invoices" 
            ADD CONSTRAINT "status_valid" 
            CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'partial'))
        `);

        // Remove the comment
        await queryRunner.query(`
            COMMENT ON COLUMN "invoices"."status" IS NULL
        `);
    }
}