import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Post,
} from '@nestjs/common';
import { sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';

@Controller()
export class HealthController {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    try {
      await sql`SELECT 1=1`.execute(this.db);
    } catch (error) {
      throw new InternalServerErrorException('Health check failed');
    }
  }
}
