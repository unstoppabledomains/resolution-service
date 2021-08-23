import { MigrationInterface, QueryRunner } from 'typeorm';

export class ContractAddressColumn1628108859702 implements MigrationInterface {
  name = 'ContractAddressColumn1628108859702';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ADD "contract_address" text NOT NULL DEFAULT '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" DROP COLUMN "contract_address"`,
    );
  }
}
