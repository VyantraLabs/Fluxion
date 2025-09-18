import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableULIDSupport1736700000000 implements MigrationInterface {
    name = 'EnableULIDSupport1736700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log('Enabling ULID support...');

        // Create ULID generation function for PostgreSQL
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION generate_ulid() RETURNS VARCHAR(36) AS $$
            DECLARE
                timestamp_part VARCHAR(10);
                random_part VARCHAR(16);
                chars VARCHAR(32) := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
                result VARCHAR(26);
                timestamp_ms BIGINT;
                i INTEGER;
            BEGIN
                timestamp_ms := EXTRACT(EPOCH FROM NOW()) * 1000;
                
                -- Convert timestamp to base32 (10 chars)
                timestamp_part := '';
                FOR i IN 1..10 LOOP
                    timestamp_part := SUBSTR(chars, (timestamp_ms % 32) + 1, 1) || timestamp_part;
                    timestamp_ms := timestamp_ms / 32;
                END LOOP;
                
                -- Generate random part (16 chars)
                random_part := '';
                FOR i IN 1..16 LOOP
                    random_part := random_part || SUBSTR(chars, FLOOR(RANDOM() * 32) + 1, 1);
                END LOOP;
                
                result := timestamp_part || random_part;
                RETURN result;
            END;
            $$ LANGUAGE plpgsql;
        `);

        console.log('ULID support enabled successfully!');
        console.log('Note: Existing columns remain unchanged for compatibility.');
        console.log('New records will use ULIDs via @BeforeInsert() hooks in entity classes.');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        console.log('Removing ULID support...');
        
        // Drop the ULID function
        await queryRunner.query(`DROP FUNCTION IF EXISTS generate_ulid()`);
        
        console.log('ULID support removed successfully!');
    }
}