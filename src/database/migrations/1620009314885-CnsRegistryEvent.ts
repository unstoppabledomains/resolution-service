import { MigrationInterface, QueryRunner } from 'typeorm';

export class CnsRegistryEvent1620009314885 implements MigrationInterface {
  name = 'CnsRegistryEvent1620009314885';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cns_registry_events" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "type" text NOT NULL, "blockchain_id" text, "block_number" integer NOT NULL, "log_index" integer, "transaction_hash" text, "return_values" json NOT NULL, "node" text, CONSTRAINT "PK_fc7a32414cf40ab000cb8319dfc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_022e6c632c487a5564719b35ab" ON "cns_registry_events" ("block_number") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f20b40ab36003636b09708f002" ON "cns_registry_events" ("node") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_91ebb379c9c474ed28df51e2c5" ON "cns_registry_events" ("block_number", "log_index") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_91ebb379c9c474ed28df51e2c5"`);
    await queryRunner.query(`DROP INDEX "IDX_f20b40ab36003636b09708f002"`);
    await queryRunner.query(`DROP INDEX "IDX_022e6c632c487a5564719b35ab"`);
    await queryRunner.query(`DROP TABLE "cns_registry_events"`);
  }
}
