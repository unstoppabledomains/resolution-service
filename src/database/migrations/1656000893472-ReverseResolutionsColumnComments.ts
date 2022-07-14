import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReverseResolutionsColumnComments1656000893472
  implements MigrationInterface
{
  name = 'ReverseResolutionsColumnComments1656000893472';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."reverse_address" IS 'unique index, the ethereum address that is configured for reverse resolution'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."blockchain" IS 'the blockhcain where the reverse resolution came from'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."network_id" IS 'the networkId where the reverse resolution came from'`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_reverse_resolution" ALTER COLUMN "domain_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."domain_id" IS 'the reverse resolution domain for this address'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."domain_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_reverse_resolution" ALTER COLUMN "domain_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."network_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."blockchain" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "domains_reverse_resolution"."reverse_address" IS NULL`,
    );
  }
}
