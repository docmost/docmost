import { KyselyDB } from '@docmost/db/types/kysely.types';
import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { Redis } from 'ioredis';
import { EnvironmentService } from '../environment/environment.service';

@Controller()
export class HealthController {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private environmentService: EnvironmentService,
  ) {}

  private readonly logger = new Logger(HealthController.name);

  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    try {
      const redis = new Redis(this.environmentService.getRedisUrl());

      await sql`SELECT 1=1`.execute(this.db);
      await redis.ping();
    } catch (error) {
      this.logger.error('Health check failed');
      throw new InternalServerErrorException();
    }
  }
}
