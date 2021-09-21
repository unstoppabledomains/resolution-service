import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceLocationField1632188507951 implements MigrationInterface {
  name = 'ReplaceLocationField1632188507951';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "network_id" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "blockchain" text NOT NULL DEFAULT 'ETH'`,
    );
    await queryRunner.query(
      `UPDATE "domains" SET blockchain='ZIL' WHERE location='ZNS'`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "location"`);
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "blockchain" text NOT NULL DEFAULT 'ETH'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "network_id" integer NOT NULL DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "network_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "blockchain"`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "blockchain"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "network_id"`);
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "location" text NOT NULL`,
    );
  }
}
