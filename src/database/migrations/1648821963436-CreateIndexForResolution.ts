import { MigrationInterface, QueryRunner } from 'typeorm';
import supportedKeysJson from 'uns/resolver-keys.json';

export class CreateIndexForResolution1648821963436
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const proms = [];
    const keys = Object.keys(supportedKeysJson.keys);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      proms.push(
        queryRunner.query(
          `create index resolution_json_index_${i} on domains_resolution USING HASH ((resolution->'${key}'))`,
        ),
      );
    }
    await Promise.all(proms);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const proms = [];
    const keys = Object.keys(supportedKeysJson.keys);
    for (let i = keys.length; i >= 0; i--) {
      proms.push(queryRunner.query(`drop index resolution_json_index_${i}`));
    }
    await Promise.all(proms);
  }
}
