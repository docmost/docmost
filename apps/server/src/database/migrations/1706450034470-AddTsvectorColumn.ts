import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTsvectorColumn1706450034470 implements MigrationInterface {
  name = 'AddTsvectorColumn1706450034470';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pages" ADD "tsv" tsvector`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "tsv"`);
  }
}
