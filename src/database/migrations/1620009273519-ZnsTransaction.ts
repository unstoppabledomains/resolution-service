import { MigrationInterface, QueryRunner } from 'typeorm';

export class ZnsTransaction1620009273519 implements MigrationInterface {
  name = 'ZnsTransaction1620009273519';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "zns_transactions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "atxuid" integer, "hash" character varying(66), "events" json NOT NULL, "block_number" integer, CONSTRAINT "PK_3448a17328ec50729e9e05d66cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4f2520658a4ecde7f67a09f10c" ON "zns_transactions" ("block_number") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_02a72bd134beabc8a9edf8ba01" ON "zns_transactions" ("hash") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_06f1eae4cee0c2bed0ad3e1e16" ON "zns_transactions" ("atxuid") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_06f1eae4cee0c2bed0ad3e1e16"`);
    await queryRunner.query(`DROP INDEX "IDX_02a72bd134beabc8a9edf8ba01"`);
    await queryRunner.query(`DROP INDEX "IDX_4f2520658a4ecde7f67a09f10c"`);
    await queryRunner.query(`DROP TABLE "zns_transactions"`);
  }
}
