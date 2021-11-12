import { MigrationInterface, QueryRunner } from 'typeorm';

export class FillDomainParents1635872404591 implements MigrationInterface {
  name = 'FillDomainParents1635872404591';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `insert into "domains" ("id", "name", "node", "parent_id")
        select "child"."id" as "id", "child"."name" as "name", "child"."node" as "node", "parent"."id" as "parent_id" 
        from "domains" "child" 
          inner join "domains" "parent" 
          on reverse(split_part(reverse("child"."name"), '.', 1)) = "parent"."name" and "child"."name" like '%.%'
       on conflict (id) do update set "parent_id"=EXCLUDED."parent_id";`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "domains" SET "parent_id" = NULL`);
  }
}
