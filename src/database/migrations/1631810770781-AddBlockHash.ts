import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBlockHash1631810770781 implements MigrationInterface {
  name = 'AddBlockHash1631810770781';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "block_hash" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "resolution_worker_status" ADD "last_mirrored_block_hash" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "resolution_worker_status" DROP COLUMN "last_mirrored_block_hash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "block_hash"`,
    );
  }
}
