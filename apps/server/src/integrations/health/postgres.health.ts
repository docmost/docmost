import { InjectKysely } from 'nestjs-kysely';
import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class PostgresHealthIndicator {
  private readonly logger = new Logger(PostgresHealthIndicator.name);

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await sql`SELECT 1=1`.execute(this.db);
      return indicator.up();
    } catch (e) {
      this.logger.error(JSON.stringify(e));
      return indicator.down(`${key} is not available`);
    }
  }
}
