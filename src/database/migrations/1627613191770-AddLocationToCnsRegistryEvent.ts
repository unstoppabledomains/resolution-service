import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLocationToCnsRegistryEvent1627613191770
  implements MigrationInterface {
  name = 'AddLocationToCnsRegistryEvent1627613191770';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "location" text NOT NULL DEFAULT 'CNS'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1be5b6a67c29c3fac15dab9d85" ON "cns_registry_events" ("location") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_1be5b6a67c29c3fac15dab9d85"`);
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "location"`,
    );
  }
}
