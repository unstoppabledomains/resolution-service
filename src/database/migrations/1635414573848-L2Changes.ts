import { MigrationInterface, QueryRunner } from 'typeorm';

export class L2Changes1635414573848 implements MigrationInterface {
  name = 'L2Changes1635414573848';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "FK_ba221474637efa543760216b5d3"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_91ebb379c9c474ed28df51e2c5"`);
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "blockchain_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ALTER COLUMN "contract_address" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0f690eced647381145b389e230" ON "cns_registry_events" ("block_number", "blockchain", "network_id", "log_index") `,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "FK_ba221474637efa543760216b5d3" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "FK_ba221474637efa543760216b5d3"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_0f690eced647381145b389e230"`);
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ALTER COLUMN "contract_address" SET DEFAULT '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "blockchain_id" text`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_91ebb379c9c474ed28df51e2c5" ON "cns_registry_events" ("block_number", "log_index") `,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "FK_ba221474637efa543760216b5d3" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }
}
