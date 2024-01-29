import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDeletedByIdToPage1699746184234 implements MigrationInterface {
    name = 'AddDeletedByIdToPage1699746184234'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" ADD "deletedById" uuid`);
        await queryRunner.query(`ALTER TABLE "pages" ADD CONSTRAINT "FK_189f605351a31458e0e30c8a9cb" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pages" DROP CONSTRAINT "FK_189f605351a31458e0e30c8a9cb"`);
        await queryRunner.query(`ALTER TABLE "pages" DROP COLUMN "deletedById"`);
    }

}
