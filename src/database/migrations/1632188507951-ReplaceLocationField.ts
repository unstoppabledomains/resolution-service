import { MigrationInterface, QueryRunner } from 'typeorm';
import { env } from '../../env';

export class ReplaceLocationField1632188507951 implements MigrationInterface {
  name = 'ReplaceLocationField1632188507951';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "network_id" integer NOT NULL DEFAULT ${env.APPLICATION.ETHEREUM.CHAIN_ID}`,
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
      `ALTER TABLE "cns_registry_events" ADD "network_id" integer NOT NULL DEFAULT ${env.APPLICATION.ETHEREUM.CHAIN_ID}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "network_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "blockchain"`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "location" text`);
    await queryRunner.query(
      `UPDATE "domains" SET "location"='CNS' WHERE "blockchain"='ETH'`,
    );
    await queryRunner.query(
      `UPDATE "domains" SET "location"='ZNS' WHERE "blockchain"='ZIL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ALTER "location" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "blockchain"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "network_id"`);
  }
}
