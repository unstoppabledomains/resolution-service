import { MigrationInterface, QueryRunner } from 'typeorm';

type DomainResolutionData = {
  id: number;
  owner: string;
  resolver: string;
  resolution: string;
  registry: string;
  blockchain: string;
  networkId: number;
};

export class DomainsResolution1635351168127 implements MigrationInterface {
  name = 'DomainsResolution1635351168127';

  private async getDomainsData(
    queryRunner: QueryRunner,
  ): Promise<DomainResolutionData[]> {
    const data = await queryRunner.query('SELECT * FROM "domains"');
    const resolutions = [];
    if (data !== undefined && Array.isArray(data) && data.length > 0) {
      for (const item of data) {
        resolutions.push({
          id: item['id'],
          owner: item['owner_address'],
          resolver: item['resolver'],
          resolution: item['resolution'],
          registry: item['registry'],
          blockchain: item['blockchain'],
          networkId: item['network_id'],
        });
      }
    }
    return resolutions;
  }
  private async getDomainsResolutionData(
    queryRunner: QueryRunner,
  ): Promise<DomainResolutionData[]> {
    const data = await queryRunner.query('SELECT * FROM "domains_resolution"');
    const resolutions = [];
    if (data !== undefined && Array.isArray(data) && data.length > 0) {
      for (const item of data) {
        if (item['blockchain'] !== 'MATIC') {
          resolutions.push({
            id: item['domain_id'],
            owner: item['owner_address'],
            resolver: item['resolver'],
            resolution: item['resolution'],
            registry: item['registry'],
            blockchain: item['blockchain'],
            networkId: item['network_id'],
          });
        }
      }
    }
    return resolutions;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_40e276698e30d5a8ad2edd96b4"`);
    await queryRunner.query(
      `CREATE TABLE "domains_resolution" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "owner_address" text, "resolver" text, "registry" text, "resolution" jsonb NOT NULL DEFAULT '{}', "blockchain" text NOT NULL, "network_id" integer NOT NULL, "domain_id" integer, CONSTRAINT "UQ_16efa381afd8187533c52240211" UNIQUE ("domain_id", "blockchain", "network_id"), CONSTRAINT "PK_25db8525757aa2b28cd5fcc2695" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bd2fbeb876cb9c1784da6edf93" ON "domains_resolution" ("domain_id", "blockchain", "network_id", "owner_address") `,
    );

    const domainsData = await this.getDomainsData(queryRunner);
    const query = `INSERT INTO "domains_resolution" ("owner_address", "registry", "resolver", "blockchain", "network_id", "resolution", "domain_id") VALUES `;
    const queryItems = [];
    for (const item of domainsData) {
      queryItems.push(
        `('${item.owner}','${item.registry}','${item.resolver}','${
          item.blockchain
        }',${item.networkId},'${JSON.stringify(item.resolution)}',${item.id})`,
      );
    }
    await queryRunner.query(query + queryItems.join(','));

    await queryRunner.query(
      `ALTER TABLE "domains" DROP COLUMN "owner_address"`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "resolver"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "resolution"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "registry"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "blockchain"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "network_id"`);
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "FK_ba221474637efa543760216b5d3" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "FK_ba221474637efa543760216b5d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "network_id" integer NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "blockchain" text NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "registry" text`);
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "resolution" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "resolver" text`);
    await queryRunner.query(`ALTER TABLE "domains" ADD "owner_address" text`);

    const domainsData = await this.getDomainsResolutionData(queryRunner);
    let query = `INSERT INTO "domains" ("id", "name", "node", "owner_address", "registry", "resolver", "blockchain", "network_id", "resolution") VALUES `;
    const queryItems = [];
    for (const item of domainsData) {
      queryItems.push(
        `(${item.id}, '', '', '${item.owner}','${item.registry}','${
          item.resolver
        }','${item.blockchain}','${item.networkId}','${JSON.stringify(
          item.resolution,
        )}')`,
      );
    }
    query += queryItems.join(',');
    query += ` ON CONFLICT (id) DO UPDATE SET "owner_address"=EXCLUDED."owner_address", "registry"=EXCLUDED."registry", "resolver"=EXCLUDED."resolver", "blockchain"=EXCLUDED."blockchain", "network_id"=EXCLUDED."network_id", "resolution"=EXCLUDED."resolution";`;
    await queryRunner.query(query);

    await queryRunner.query(`DROP INDEX "IDX_bd2fbeb876cb9c1784da6edf93"`);
    await queryRunner.query(`DROP TABLE "domains_resolution"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_40e276698e30d5a8ad2edd96b4" ON "domains" ("owner_address") `,
    );
  }
}
