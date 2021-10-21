import { MigrationInterface, QueryRunner } from 'typeorm';
import { env } from '../../env';

export class ReplaceLocationField1632188507951 implements MigrationInterface {
  name = 'ReplaceLocationField1632188507951';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domains" ADD "blockchain" text`);
    await queryRunner.query(
      `UPDATE "domains" SET "blockchain"='ETH' WHERE "location"='CNS'`,
    );
    await queryRunner.query(
      `UPDATE "domains" SET "blockchain"='ETH' WHERE "location"='UNSL1'`,
    );
    await queryRunner.query(
      `UPDATE "domains" SET "blockchain"='ZIL' WHERE "location"='ZNS'`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ALTER "blockchain" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "network_id" integer`);
    await queryRunner.query(
      `UPDATE "domains" SET "network_id"=${env.APPLICATION.ETHEREUM.NETWORK_ID} WHERE "blockchain"='ETH'`,
    );
    await queryRunner.query(
      `UPDATE "domains" SET "network_id"=${env.APPLICATION.ZILLIQA.NETWORK_ID} WHERE "blockchain"='ZIL'`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ALTER "network_id" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "location"`);
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "blockchain" text`,
    );
    await queryRunner.query(
      `UPDATE "cns_registry_events" SET "blockchain"='ETH'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ALTER "blockchain" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "network_id" integer`,
    );
    await queryRunner.query(
      `UPDATE "cns_registry_events" SET "network_id"=${env.APPLICATION.ETHEREUM.NETWORK_ID}`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ALTER "network_id" SET NOT NULL`,
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
