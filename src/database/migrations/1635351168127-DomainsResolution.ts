import { MigrationInterface, QueryRunner } from 'typeorm';

export class DomainsResolution1635351168127 implements MigrationInterface {
  name = 'DomainsResolution1635351168127';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_40e276698e30d5a8ad2edd96b4"`);
    await queryRunner.query(
      `CREATE TABLE "domains_resolution" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "owner_address" text, "resolver" text, "registry" text, "resolution" jsonb NOT NULL DEFAULT '{}', "blockchain" text NOT NULL, "network_id" integer NOT NULL, "domain_id" integer, CONSTRAINT "UQ_16efa381afd8187533c52240211" UNIQUE ("domain_id", "blockchain", "network_id"), CONSTRAINT "PK_25db8525757aa2b28cd5fcc2695" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd2fbeb876cb9c1784da6edf93" ON "domains_resolution" ("domain_id", "blockchain", "network_id", "owner_address") `,
    );

    await queryRunner.query(
      `INSERT INTO "domains_resolution" ("owner_address", "registry", "resolver", "blockchain", "network_id", "resolution", "domain_id")
       SELECT "owner_address", "registry", "resolver", "blockchain", "network_id", "resolution", "domains"."id" as "domain_id" FROM "domains"`,
    );

    await queryRunner.query(
      `ALTER TABLE "domains" DROP COLUMN "owner_address"`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "resolver"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "resolution"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "registry"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "blockchain"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "network_id"`);
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "FK_ba221474637efa543760216b5d3" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "FK_ba221474637efa543760216b5d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "network_id" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "blockchain" text NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "registry" text`);
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "resolution" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "resolver" text`);
    await queryRunner.query(`ALTER TABLE "domains" ADD "owner_address" text`);

    await queryRunner.query(
      `INSERT INTO "domains" ("id", "owner_address", "registry", "resolver", "blockchain", "network_id", "resolution")
        SELECT "domain_id", "owner_address", "registry", "resolver", "blockchain", "network_id", "resolution", FROM "domains_resolution"
        ON CONFLICT (id) DO UPDATE SET "owner_address"=EXCLUDED."owner_address", "registry"=EXCLUDED."registry", "resolver"=EXCLUDED."resolver", "blockchain"=EXCLUDED."blockchain", "network_id"=EXCLUDED."network_id", "resolution"=EXCLUDED."resolution"`,
    );

    await queryRunner.query(`DROP INDEX "IDX_bd2fbeb876cb9c1784da6edf93"`);
    await queryRunner.query(`DROP TABLE "domains_resolution"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_40e276698e30d5a8ad2edd96b4" ON "domains" ("owner_address") `,
    );
  }
}
