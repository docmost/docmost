import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { promises as fs } from 'fs';
import { Migrator, FileMigrationProvider } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(`Database${MigrationService.name}`);

  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async migrateToLatest(): Promise<void> {
    const migrator = new Migrator({
      db: this.db,
      provider: new FileMigrationProvider({
        fs,
        path,
        migrationFolder: path.join(__dirname, '..', 'migrations'),
      }),
    });

    const { error, results } = await migrator.migrateToLatest();

    if (results && results.length === 0) {
      this.logger.log('No pending database migrations');
      return;
    }

    results?.forEach((it) => {
      if (it.status === 'Success') {
        this.logger.log(
          `Migration "${it.migrationName}" executed successfully`,
        );
      } else if (it.status === 'Error') {
        this.logger.error(`Failed to execute migration "${it.migrationName}"`);
      }
    });

    if (error) {
      this.logger.error('Failed to run database migration. Exiting program.');
      this.logger.error(error);
      process.exit(1);
    }
  }
}
