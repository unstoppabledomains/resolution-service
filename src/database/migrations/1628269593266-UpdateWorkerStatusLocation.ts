import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateWorkerStatusLocation1628269593266
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "resolution_worker_status" SET location='ETH' WHERE location='CNS'`,
    );
    await queryRunner.query(
      `UPDATE "resolution_worker_status" SET location='ZIL' WHERE location='ZNS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "resolution_worker_status" SET location='CNS' WHERE location='ETH'`,
    );
    await queryRunner.query(
      `UPDATE "resolution_worker_status" SET location='ZNS' WHERE location='ZIL'`,
    );
  }
}
