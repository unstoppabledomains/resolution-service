import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageFieldToDomain1628218575346 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const DEFAULT_IMAGE_URL = 'https://storage.googleapis.com/dot-crypto-metadata-api/unstoppabledomains_crypto.png' as const;
    const CUSTOM_IMAGE_URL = 'https://storage.googleapis.com/dot-crypto-metadata.appspot.com/images/custom' as const;
    const domainsWithCustomImage = {
      'code.crypto': 'code.svg',
      'web3.crypto': 'web3.svg',
      'privacy.crypto': 'privacy.svg',
      'surf.crypto': 'surf.svg',
      'hosting.crypto': 'hosting.svg',
      'india.crypto': 'india.jpg',
    };

    await queryRunner.query(
      `ALTER TABLE domains ADD COLUMN image text DEFAULT '${DEFAULT_IMAGE_URL}'`,
    );
    for (const [domain, extension] of Object.entries(domainsWithCustomImage)) {
      await queryRunner.query(
        `UPDATE domains SET image = '${CUSTOM_IMAGE_URL}/${extension}' WHERE name = '${domain}'`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE domains DROP COLUMN image`);
  }
}
