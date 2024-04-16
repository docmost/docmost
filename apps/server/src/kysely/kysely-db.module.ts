import { Global, Module } from '@nestjs/common';
import { KyselyModule } from 'nestjs-kysely';
import { EnvironmentService } from '../integrations/environment/environment.service';
import { CamelCasePlugin, LogEvent, PostgresDialect } from 'kysely';
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
          }),
        }),
        plugins: [new CamelCasePlugin()],
        log: (event: LogEvent) => {
          if (environmentService.getEnv() !== 'development') return;
          if (event.level === 'query') {
            console.log(event.query.sql);
            //if (event.query.parameters.length > 0) {
            //console.log('parameters: ' + event.query.parameters);
            //}
            console.log('time: ' + event.queryDurationMillis);
          }
        },
      }),
    }),
  ],
  providers: [
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
  ],
})
export class KyselyDbModule {}
