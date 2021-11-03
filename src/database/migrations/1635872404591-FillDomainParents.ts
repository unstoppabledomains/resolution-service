import { MigrationInterface, QueryRunner } from 'typeorm';

type DomainData = { id: number; name: string; parent: number | null };

export class FillDomainParents1635872404591 implements MigrationInterface {
  name = 'FillDomainParents1635872404591';

  private async getDomainsData(
    queryRunner: QueryRunner,
  ): Promise<DomainData[]> {
    const data = await queryRunner.query('SELECT * FROM "domains"');
    const resolutions: DomainData[] = [];
    if (data !== undefined && Array.isArray(data) && data.length > 0) {
      for (const item of data) {
        resolutions.push({
          id: item['id'],
          name: item['owner_address'],
          parent: null,
        });
      }
    }
    return resolutions;
  }

  private findDomainExtensions(domains: DomainData[]): DomainData[] {
    const extensions: string[] = [];
    for (const domain of domains) {
      const extension = domain.name.split('.').pop() || '';
      if (!extensions.includes(extension)) {
        extensions.push(extension);
      }
    }
    return domains.filter((val) => extensions.includes(val.name));
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const domains = await this.getDomainsData(queryRunner);
    const extensions = this.findDomainExtensions(domains);
    for (const domain of domains) {
      if (!extensions.includes(domain)) {
        const extension = domain.name.split('.').pop() || '';
        domain.parent =
          extensions.find((val) => val.name == extension)?.id || null;
      }
    }

    let query = `INSERT INTO "domains" ("id", "name", "parent") VALUES `;
    const queryItems = [];
    for (const item of domains) {
      queryItems.push(`(${item.id}, '${item.name}', ${item.parent})`);
    }
    query += queryItems.join(',');
    query += ` ON CONFLICT (id) DO UPDATE SET "parent"=EXCLUDED."parent";`;
    await queryRunner.query(query);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "domains" SET "parent" = NULL`);
  }
}
