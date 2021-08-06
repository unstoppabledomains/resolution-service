import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKeyModel1628251136645 implements MigrationInterface {
  name = 'ApiKeyModel1628251136645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "apikeys" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" text NOT NULL, "api_key" uuid NOT NULL, CONSTRAINT "UQ_40f2c92d095006f456471478d8c" UNIQUE ("name"), CONSTRAINT "UQ_e3bfdf021596dfcfd149e7c88a7" UNIQUE ("api_key"), CONSTRAINT "PK_5a37f8db0aa11ac170c74776c7d" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "apikeys"`);
  }
}
