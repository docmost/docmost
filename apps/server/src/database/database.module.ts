import {
  Global,
  Logger,
  Module,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectKysely, KyselyModule } from 'nestjs-kysely';
import { EnvironmentService } from '../integrations/environment/environment.service';
import { CamelCasePlugin, LogEvent, PostgresDialect, sql } from 'kysely';
import { Pool, types } from 'pg';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageRepo } from './repos/page/page.repo';
import { CommentRepo } from './repos/comment/comment.repo';
import { PageHistoryRepo } from './repos/page/page-history.repo';
import { AttachmentRepo } from './repos/attachment/attachment.repo';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import * as process from 'node:process';
import { MigrationService } from '@docmost/db/services/migration.service';
import { UserTokenRepo } from './repos/user-token/user-token.repo';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo';

// https://github.com/brianc/node-postgres/issues/811
types.setTypeParser(types.builtins.INT8, (val) => Number(val));

@Global()
@Module({
  imports: [
    KyselyModule.forRootAsync({
      imports: [],
      inject: [EnvironmentService],
      useFactory: (environmentService: EnvironmentService) => ({
        dialect: new PostgresDialect({
          pool: new Pool({
            connectionString: environmentService.getDatabaseURL(),
          }).on('error', (err) => {
            console.error('Database error:', err.message);
          }),
        }),
        plugins: [new CamelCasePlugin()],
        log: (event: LogEvent) => {
          if (environmentService.getNodeEnv() !== 'development') return;
          if (event.level === 'query') {
            // console.log(event.query.sql);
            //if (event.query.parameters.length > 0) {
            //console.log('parameters: ' + event.query.parameters);
            //}
            // console.log('time: ' + event.queryDurationMillis);
          }
        },
      }),
    }),
  ],
  providers: [
    MigrationService,
    WorkspaceRepo,
    UserRepo,
    GroupRepo,
    GroupUserRepo,
    SpaceRepo,
    SpaceMemberRepo,
    PageRepo,
    PageHistoryRepo,
    CommentRepo,
    AttachmentRepo,
    UserTokenRepo,
    BacklinkRepo,
  ],
  exports: [
    WorkspaceRepo,
    UserRepo,
    GroupRepo,
    GroupUserRepo,
    SpaceRepo,
    SpaceMemberRepo,
    PageRepo,
    PageHistoryRepo,
    CommentRepo,
    AttachmentRepo,
    UserTokenRepo,
    BacklinkRepo,
  ],
})
export class DatabaseModule implements OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly migrationService: MigrationService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async onApplicationBootstrap() {
    await this.establishConnection();

    if (this.environmentService.getNodeEnv() === 'production') {
      await this.migrationService.migrateToLatest();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.db) {
      await this.db.destroy();
    }
  }

  async establishConnection() {
    const retryAttempts = 15;
    const retryDelay = 3000;

    this.logger.log('Establishing database connection');
    for (let i = 0; i < retryAttempts; i++) {
      try {
        await sql`SELECT 1=1`.execute(this.db);
        this.logger.log('Database connection successful');
        break;
      } catch (err) {
        if (err['errors']) {
          this.logger.error(err['errors'][0]);
        } else {
          this.logger.error(err);
        }

        if (i < retryAttempts - 1) {
          this.logger.log(
            `Retrying [${i + 1}/${retryAttempts}] in ${retryDelay / 1000} seconds`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } else {
          this.logger.error(
            `Failed to connect to database after ${retryAttempts} attempts. Exiting...`,
          );
          process.exit(1);
        }
      }
    }
  }
}
