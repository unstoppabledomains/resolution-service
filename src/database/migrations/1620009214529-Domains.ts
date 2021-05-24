import { MigrationInterface, QueryRunner } from 'typeorm';

export class Domains1620009214529 implements MigrationInterface {
  name = 'Domains1620009214529';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "domains" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" text NOT NULL, "node" text NOT NULL, "owner_address" text, "resolver" text, "resolution" jsonb NOT NULL DEFAULT '{}', "location" text NOT NULL, "parent_id" integer, CONSTRAINT "PK_05a6b087662191c2ea7f7ddfc4d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f36af68a2defaa8ae5fdd9b564" ON "domains" ("name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_5cd130ec1b78fd5f65829dab56" ON "domains" ("node") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40e276698e30d5a8ad2edd96b4" ON "domains" ("owner_address") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0098b266e6691783004667114f" ON "domains" ("parent_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ADD CONSTRAINT "FK_0098b266e6691783004667114f6" FOREIGN KEY ("parent_id") REFERENCES "domains"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains" DROP CONSTRAINT "FK_0098b266e6691783004667114f6"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_0098b266e6691783004667114f"`);
    await queryRunner.query(`DROP INDEX "IDX_40e276698e30d5a8ad2edd96b4"`);
    await queryRunner.query(`DROP INDEX "IDX_5cd130ec1b78fd5f65829dab56"`);
    await queryRunner.query(`DROP INDEX "IDX_f36af68a2defaa8ae5fdd9b564"`);
    await queryRunner.query(`DROP TABLE "domains"`);
  }
}
