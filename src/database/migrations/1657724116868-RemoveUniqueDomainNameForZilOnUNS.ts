import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUniqueDomainNameForZilOnUNS1657724116868
  implements MigrationInterface
{
  name = 'RemoveUniqueDomainNameForZilOnUNS1657724116868';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f36af68a2defaa8ae5fdd9b564"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f36af68a2defaa8ae5fdd9b564" ON "domains" ("name") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f36af68a2defaa8ae5fdd9b564"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_f36af68a2defaa8ae5fdd9b564" ON "domains" ("name") `,
    );
  }
}
