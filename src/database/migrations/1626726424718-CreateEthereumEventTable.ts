import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEthereumEventTable1626726424718
  implements MigrationInterface {
  name = 'CreateEthereumEventTable1626726424718';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ethereum_events" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "location" text NOT NULL, "type" text NOT NULL, "blockchain_id" text, "block_number" integer NOT NULL, "log_index" integer, "transaction_hash" text, "return_values" json NOT NULL, "node" text, CONSTRAINT "PK_84da0c313d283f0630629abba31" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00dc00c89bbbf107c568cf65cd" ON "ethereum_events" ("location") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef73491aa40e9c486bd6fb9414" ON "ethereum_events" ("block_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f3fdcc90ef93da6e31683a8ce" ON "ethereum_events" ("node") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bb4566f27912e34a76ae6d2407" ON "ethereum_events" ("block_number", "log_index") `,
    );
    await queryRunner.query(`DROP TABLE "cns_registry_events"`);
    await queryRunner.query(`DROP TABLE "uns_registry_events"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_00dc00c89bbbf107c568cf65cd"`);
    await queryRunner.query(`DROP INDEX "IDX_bb4566f27912e34a76ae6d2407"`);
    await queryRunner.query(`DROP INDEX "IDX_4f3fdcc90ef93da6e31683a8ce"`);
    await queryRunner.query(`DROP INDEX "IDX_ef73491aa40e9c486bd6fb9414"`);
    await queryRunner.query(`DROP INDEX "IDX_00dc00c89bbbf107c568cf65cd"`);
    await queryRunner.query(`DROP TABLE "ethereum_events"`);
  }
}
