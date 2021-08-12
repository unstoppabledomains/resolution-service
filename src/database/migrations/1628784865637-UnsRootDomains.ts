import { MigrationInterface, QueryRunner } from 'typeorm';

export class UnsRootDomains1628784865637 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "domains" (name, node, location)
          VALUES ('coin', '0x7674e7282552c15f203b9c4a6025aeaf28176ef7f5451b280f9bada3f8bc98e2', 'UNSL1'),
                 ('wallet', '0x1e3f482b3363eb4710dae2cb2183128e272eafbe137f686851c1caea32502230', 'UNSL1'),
                 ('bitcoin', '0x042fb01c1e43fb4a32f85b41c821e17d2faeac58cfc5fb23f80bc00c940f85e3', 'UNSL1'),
                 ('x', '0x241e7e2b7fd7333b3c0c049b326316b811af0c01cfc0c7a90b466fda3a70fc2d', 'UNSL1'),
                 ('888', '0x5c828ec285c0bf152a30a325b3963661a80cb87641d60920344caf04d4a0f31e', 'UNSL1'),
                 ('nft', '0xb75cf4f3d8bc3deb317ed5216d898899d5cc6a783f65f6768eb9bcb89428670d', 'UNSL1'),
                 ('dao', '0xb5f2bbf81da581299d4ff7af60560c0ac854196f5227328d2d0c2bb0df33e553', 'UNSL1')
          ON CONFLICT (name) DO NOTHING
    `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "domains" WHERE name in ('coin','wallet','bitcoin','x','888','nft','dao')`,
    );
  }
}
