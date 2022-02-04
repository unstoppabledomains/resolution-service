import { MigrationInterface, QueryRunner } from 'typeorm';

export class SetTldsParentsNull1643977980727 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE domains SET parent_id=null WHERE parent_id = id`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE domains SET parent_id=id WHERE parent_id is null`,
    );
  }
}
