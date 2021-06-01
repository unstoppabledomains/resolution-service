import { MigrationInterface, QueryRunner } from 'typeorm';
import { logger } from '../../logger';

export class WorkerStatus1622195178864 implements MigrationInterface {
  name = 'WorkerStatus1622195178864';

  private async getValue(
    query: string,
    defaultVal: number,
    queryRunner: QueryRunner,
  ): Promise<number> {
    const data = await queryRunner.query(query);
    if (data !== undefined && Array.isArray(data) && data.length > 0) {
      const value = Object.values(data[0]);
      if (value.length > 0 && Number.isInteger(value[0])) {
        return value[0] as number;
      }
    }
    return defaultVal;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "resolution_worker_status" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "location" text UNIQUE NOT NULL, "last_mirrored_block_number" integer NOT NULL, "last_atxuid" integer NULL, CONSTRAINT "PK_66203c831e1c54ed04a1b531542" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b1fb6a16c3def29f6272a8d063" ON "resolution_worker_status" ("location") `,
    );

    const cnsLastBlock = await this.getValue(
      `SELECT MAX(block_number) FROM "cns_registry_events"`,
      0,
      queryRunner,
    );
    const znsLastBlock = await this.getValue(
      `SELECT MAX(block_number) FROM "zns_transactions"`,
      0,
      queryRunner,
    );
    const znsAtxuid = await this.getValue(
      `SELECT MAX(atxuid) FROM "zns_transactions"`,
      -1,
      queryRunner,
    );

    await queryRunner.query(`INSERT INTO "resolution_worker_status" (location, last_mirrored_block_number, last_atxuid)
                             VALUES ('CNS', ${cnsLastBlock}, null),
                                    ('ZNS', ${znsLastBlock}, ${znsAtxuid})
        ON CONFLICT (location) DO NOTHING`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_b1fb6a16c3def29f6272a8d063"`);
    await queryRunner.query(`DROP TABLE "resolution_worker_status"`);
  }
}
