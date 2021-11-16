import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDomainIndexes1637082653571 implements MigrationInterface {
  name = 'AddDomainIndexes1637082653571';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_83fa45b33143aaef55e6b43393" ON "cns_registry_events" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_693c855fdccaa838dbff042bc8" ON "cns_registry_events" ("blockchain") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_75afd37285f28786043486d731" ON "cns_registry_events" ("transaction_hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_59070058bc65864b4a6db22b76" ON "cns_registry_events" ("type", "blockchain", "block_number", "node") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_59070058bc65864b4a6db22b76"`);
    await queryRunner.query(`DROP INDEX "IDX_75afd37285f28786043486d731"`);
    await queryRunner.query(`DROP INDEX "IDX_693c855fdccaa838dbff042bc8"`);
    await queryRunner.query(`DROP INDEX "IDX_83fa45b33143aaef55e6b43393"`);
  }
}
