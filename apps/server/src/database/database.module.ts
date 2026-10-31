import { Global, Logger, Module, OnApplicationBootstrap } from '@nestjs/common';
import { InjectKysely, KyselyModule } from 'nestjs-kysely';
import { EnvironmentService } from '../integrations/environment/environment.service.js';
import { CamelCasePlugin, LogEvent, sql } from 'kysely';
import { GroupRepo } from '@docmost/db/repos/group/group.repo.js';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo.js';
import { UserRepo } from '@docmost/db/repos/user/user.repo.js';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo.js';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo.js';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo.js';
import { PageRepo } from './repos/page/page.repo.js';
import { PagePermissionRepo } from './repos/page/page-permission.repo.js';
import { CommentRepo } from './repos/comment/comment.repo.js';
import { PageTransclusionsRepo } from './repos/page-transclusions/page-transclusions.repo.js';
import { PageTransclusionReferencesRepo } from './repos/page-transclusions/page-transclusion-references.repo.js';
import { PageHistoryRepo } from './repos/page/page-history.repo.js';
import { AttachmentRepo } from './repos/attachment/attachment.repo.js';
import { KyselyDB } from '@docmost/db/types/kysely.types.js';
import * as process from 'node:process';
import { MigrationService } from '@docmost/db/services/migration.service.js';
import { UserTokenRepo } from './repos/user-token/user-token.repo.js';
import { UserSessionRepo } from '@docmost/db/repos/session/user-session.repo.js';
import { BacklinkRepo } from '@docmost/db/repos/backlink/backlink.repo.js';
import { ShareRepo } from '@docmost/db/repos/share/share.repo.js';
import { PublicSpaceRepo } from '@docmost/db/repos/public-space/public-space.repo.js';
import { NotificationRepo } from '@docmost/db/repos/notification/notification.repo.js';
import { WatcherRepo } from '@docmost/db/repos/watcher/watcher.repo.js';
import { LabelRepo } from '@docmost/db/repos/label/label.repo.js';
import { FavoriteRepo } from '@docmost/db/repos/favorite/favorite.repo.js';
import { TemplateRepo } from '@docmost/db/repos/template/template.repo.js';
import { PageListener } from '@docmost/db/listeners/page.listener.js';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';
import { normalizePostgresUrl } from '../common/helpers/index.js';

@Global()
@Module({
  imports: [
    KyselyModule.forRootAsync({
      imports: [],
      inject: [EnvironmentService],
      useFactory: (environmentService: EnvironmentService) => ({
        dialect: new PostgresJSDialect({
          postgres: postgres(
            normalizePostgresUrl(environmentService.getDatabaseURL()),
            {
              max: environmentService.getDatabaseMaxPool(),
              onnotice: () => {},
              types: {
                bigint: {
                  to: 20,
                  from: [20, 1700],
                  serialize: (value: number) => value.toString(),
                  parse: (value: string) => Number.parseInt(value),
                },
              },
            },
          ),
        }),
        plugins: [new CamelCasePlugin()],
        log: (event: LogEvent) => {
          if (environmentService.getNodeEnv() !== 'development') return;
          const logger = new Logger(DatabaseModule.name);
          if (process.env.DEBUG_DB?.toLowerCase() === 'true') {
            logger.debug(event.query.sql);
            logger.debug('query time: ' + event.queryDurationMillis + ' ms');
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
    PagePermissionRepo,
    PageTransclusionsRepo,
    PageTransclusionReferencesRepo,
    PageHistoryRepo,
    CommentRepo,
    FavoriteRepo,
    AttachmentRepo,
    UserTokenRepo,
    UserSessionRepo,
    BacklinkRepo,
    ShareRepo,
    PublicSpaceRepo,
    NotificationRepo,
    WatcherRepo,
    LabelRepo,
    TemplateRepo,
    PageListener,
  ],
  exports: [
    WorkspaceRepo,
    UserRepo,
    GroupRepo,
    GroupUserRepo,
    SpaceRepo,
    SpaceMemberRepo,
    PageRepo,
    PagePermissionRepo,
    PageTransclusionsRepo,
    PageTransclusionReferencesRepo,
    PageHistoryRepo,
    CommentRepo,
    FavoriteRepo,
    AttachmentRepo,
    UserTokenRepo,
    UserSessionRepo,
    BacklinkRepo,
    ShareRepo,
    PublicSpaceRepo,
    NotificationRepo,
    WatcherRepo,
    LabelRepo,
    TemplateRepo,
  ],
})
export class DatabaseModule implements OnApplicationBootstrap {
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
