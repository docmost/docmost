import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTSVColumnIndex1711150345785 implements MigrationInterface {
  name = 'AddTSVColumnIndex1711150345785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM entity does not support custom index type
    // if we don't set the index on the entity,
    // TypeORM will always generate the index here in new migrations
    // dropping previous index to recreate using GIN
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_tsv";`);
    await queryRunner.query(
      `CREATE INDEX "IDX_pages_tsv" ON pages USING GIN ("tsv");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_tsv";`);
  }
}
