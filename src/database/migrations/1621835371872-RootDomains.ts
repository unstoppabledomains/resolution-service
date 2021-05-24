import { MigrationInterface, QueryRunner } from 'typeorm';

export class RootDomains1621835371872 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "domains" (name, node, location)
            VALUES ('zil', '0x9915d0456b878862e822e2361da37232f626a2e47505c8795134a95d36138ed3', 'ZNS'),
                   ('crypto', '0x0f4a10a4f46c288cea365fcf45cccf0e9d901b945b9829ccdb54c10dc3cb7a6f', 'CNS')
            ON CONFLICT (name) DO NOTHING
         `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE from "domains"
            where "name" = 'crypto' or "name" = 'zil'`,
    );
  }
}
