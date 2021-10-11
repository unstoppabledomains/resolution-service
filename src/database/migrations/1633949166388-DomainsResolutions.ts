import { MigrationInterface, QueryRunner } from 'typeorm';
import { env } from '../../env';

type DomainResolutionData = {
  id: number;
  owner: string;
  resolver: string;
  resolution: string;
  registry: string;
  location: string;
};

export class DomainsResolutions1633949166388 implements MigrationInterface {
  name = 'DomainsResolutions1633949166388';

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
          location: item['location'],
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
            location: item['location'],
          });
        }
      }
    }
    return resolutions;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_40e276698e30d5a8ad2edd96b4"`);
    await queryRunner.query(
      `CREATE TABLE "domains_resolution" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "owner_address" text, "resolver" text, "registry" text, "location" text NOT NULL, "resolution" jsonb NOT NULL DEFAULT '{}', "blockchain" text NOT NULL, "network_id" integer NOT NULL, "domain_id" integer, CONSTRAINT "UQ_550d232d52279ef61a7afd70ac2" UNIQUE ("id", "blockchain", "network_id"), CONSTRAINT "PK_25db8525757aa2b28cd5fcc2695" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c945d466e308bfb10aa7f69014" ON "domains_resolution" ("owner_address") `,
    );

    const domainsData = await this.getDomainsData(queryRunner);
    const query = `INSERT INTO "domains_resolution" ("owner_address", "registry", "resolver", "location", "blockchain", "network_id", "resolution", "domain_id") VALUES `;
    const queryItems = [];
    for (const item of domainsData) {
      const blockchain = item.location == 'ZNS' ? 'ZIL' : 'ETH';
      const location = item.location == 'UNSL1' ? 'UNS' : item.location;
      const netId =
        item.location == 'ZNS'
          ? env.APPLICATION.ZILLIQA.NETWORK_ID
          : env.APPLICATION.ETHEREUM.CHAIN_ID;
      queryItems.push(
        `('${item.owner}','${item.registry}','${
          item.resolver
        }','${location}','${blockchain}',${netId},'${JSON.stringify(
          item.resolution,
        )}',${item.id})`,
      );
    }
    await queryRunner.query(query + queryItems.join(','));

    await queryRunner.query(
      `ALTER TABLE "domains" DROP COLUMN "owner_address"`,
    );
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "resolver"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "resolution"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "location"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "registry"`);
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ALTER COLUMN "contract_address" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" ADD CONSTRAINT "FK_ba221474637efa543760216b5d3" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "domains_resolution" DROP CONSTRAINT "FK_ba221474637efa543760216b5d3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cns_registry_events" ALTER COLUMN "contract_address" SET DEFAULT '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe'`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "registry" text`);
    await queryRunner.query(`ALTER TABLE "domains" ADD "location" text`);
    await queryRunner.query(
      `ALTER TABLE "domains" ADD "resolution" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(`ALTER TABLE "domains" ADD "resolver" text`);
    await queryRunner.query(`ALTER TABLE "domains" ADD "owner_address" text`);

    const domainsData = await this.getDomainsResolutionData(queryRunner);
    let query = `INSERT INTO "domains" ("id", "name", "node", "owner_address", "registry", "resolver", "location", "resolution") VALUES `;
    const queryItems = [];
    for (const item of domainsData) {
      const location = item.location == 'UNS' ? 'UNSL1' : item.location;
      queryItems.push(
        `(${item.id}, '', '', '${item.owner}','${item.registry}','${
          item.resolver
        }','${location}','${JSON.stringify(item.resolution)}')`,
      );
    }
    query += queryItems.join(',');
    query += ` ON CONFLICT (id) DO UPDATE SET "owner_address"=EXCLUDED."owner_address", "registry"=EXCLUDED."registry", "resolver"=EXCLUDED."resolver", "location"=EXCLUDED."location", "resolution"=EXCLUDED."resolution";`;
    await queryRunner.query(query);

    await queryRunner.query(`DROP INDEX "IDX_c945d466e308bfb10aa7f69014"`);
    await queryRunner.query(`DROP TABLE "domains_resolution"`);
    await queryRunner.query(
      `ALTER TABLE "domains" ALTER COLUMN "location" SET NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40e276698e30d5a8ad2edd96b4" ON "domains" ("owner_address") `,
    );
  }
}
