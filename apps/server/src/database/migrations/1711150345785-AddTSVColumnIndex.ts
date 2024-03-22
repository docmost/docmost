import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTSVColumnIndex1711150345785 implements MigrationInterface {
  name = 'AddTSVColumnIndex1711150345785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_pages_tsv" ON pages USING GIN ("tsv");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pages_tsv";`);
  }
}
