import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeSpaceCreatorIdNullable1711053025788 implements MigrationInterface {
    name = 'MakeSpaceCreatorIdNullable1711053025788'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "FK_8469f60fb94d43a0280a83d0b35"`);
        await queryRunner.query(`ALTER TABLE "spaces" ALTER COLUMN "creatorId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD CONSTRAINT "FK_8469f60fb94d43a0280a83d0b35" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "spaces" DROP CONSTRAINT "FK_8469f60fb94d43a0280a83d0b35"`);
        await queryRunner.query(`ALTER TABLE "spaces" ALTER COLUMN "creatorId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "spaces" ADD CONSTRAINT "FK_8469f60fb94d43a0280a83d0b35" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
