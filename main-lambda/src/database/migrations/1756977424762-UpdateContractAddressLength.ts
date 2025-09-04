import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateContractAddressLength1756977424762 implements MigrationInterface {
    name = 'UpdateContractAddressLength1756977424762'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_314f713cd1291f26c58a1a025a"`);
        await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "contract_address"`);
        await queryRunner.query(`ALTER TABLE "tokens" ADD "contract_address" character varying(100)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_314f713cd1291f26c58a1a025a" ON "tokens" ("contract_address", "network_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_314f713cd1291f26c58a1a025a"`);
        await queryRunner.query(`ALTER TABLE "tokens" DROP COLUMN "contract_address"`);
        await queryRunner.query(`ALTER TABLE "tokens" ADD "contract_address" character varying(42)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_314f713cd1291f26c58a1a025a" ON "tokens" ("contract_address", "network_id") `);
    }

}
