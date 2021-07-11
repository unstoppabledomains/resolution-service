import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnsRegistryEvent1626038055507 implements MigrationInterface {
  name = 'UnsRegistryEvent1626038055507';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "uns_registry_events" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "type" text NOT NULL, "blockchain_id" text, "block_number" integer NOT NULL, "log_index" integer, "transaction_hash" text, "return_values" json NOT NULL, "node" text, CONSTRAINT "PK_e7b8033a9f5528162c60c1fc2ef" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_67296bdf4e2ce465fc0ea70f47" ON "uns_registry_events" ("block_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9f30f2e65e369798c68b6c069c" ON "uns_registry_events" ("node") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_327632cc2b1411a74c8cca1983" ON "uns_registry_events" ("block_number", "log_index") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_327632cc2b1411a74c8cca1983"`);
    await queryRunner.query(`DROP INDEX "IDX_9f30f2e65e369798c68b6c069c"`);
    await queryRunner.query(`DROP INDEX "IDX_67296bdf4e2ce465fc0ea70f47"`);
    await queryRunner.query(`DROP TABLE "uns_registry_events"`);
  }
}
