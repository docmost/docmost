import { InjectKysely } from 'nestjs-kysely';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class PostgresHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(PostgresHealthIndicator.name);

  constructor(@InjectKysely() private readonly db: KyselyDB) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    let isHealthy = false;

    try {
      await sql`SELECT 1=1`.execute(this.db);
      isHealthy = true;
    } catch (e) {
      this.logger.error(JSON.stringify(e));
    }

    if (isHealthy) {
      return this.getStatus(key, isHealthy);
    } else {
      throw new HealthCheckError(
        `${key} is not available`,
        this.getStatus(key, isHealthy),
      );
    }
  }
}
