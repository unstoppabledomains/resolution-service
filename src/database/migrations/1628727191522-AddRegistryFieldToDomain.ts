import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRegistryFieldToDomain1628727191522
  implements MigrationInterface {
  name = 'AddRegistryFieldToDomain1628727191522';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domains" ADD "registry" text`);
    await queryRunner.query(
      `UPDATE domains SET registry = '0x9611c53be6d1b32058b2747bdececed7e1216793' WHERE location = 'ZNS'`,
    );
    await queryRunner.query(
      `UPDATE domains SET registry = '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe' WHERE location = 'CNS'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "registry"`);
  }
}
