import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReverseResolutions1653485291432 implements MigrationInterface {
  name = 'AddReverseResolutions1653485291432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "domains_reverse_resolution" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "reverse_address" text NOT NULL, "blockchain" text NOT NULL, "network_id" integer NOT NULL, "domain_id" integer, CONSTRAINT "UQ_3a9de7d317da6863342abf260d6" UNIQUE ("domain_id", "blockchain", "network_id"), CONSTRAINT "PK_77c567ea2501f7259ddb784b224" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f50f6f6b13b258e869175a5f7f" ON "domains_reverse_resolution" ("reverse_address") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a4dfceadef2ea1bc051c520abe" ON "domains_reverse_resolution" ("domain_id", "blockchain", "network_id", "reverse_address") `,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_reverse_resolution" ADD CONSTRAINT "FK_fffaf1e63f42f64bd2b317ad8c7" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_reverse_resolution" DROP CONSTRAINT "FK_fffaf1e63f42f64bd2b317ad8c7"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_a4dfceadef2ea1bc051c520abe"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f50f6f6b13b258e869175a5f7f"`,
    );
    await queryRunner.query(`DROP TABLE "domains_reverse_resolution"`);
  }
}
