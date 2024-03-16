import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { PageModule } from './page/page.module';
import { StorageModule } from '../integrations/storage/storage.module';
import { AttachmentModule } from './attachment/attachment.module';
import { EnvironmentModule } from '../environment/environment.module';
import { CommentModule } from './comment/comment.module';
import { SearchModule } from './search/search.module';
import { SpaceModule } from './space/space.module';
import { GroupModule } from './group/group.module';
import { CaslModule } from './casl/casl.module';
import { DomainMiddleware } from '../middlewares/domain.middleware';

@Module({
  imports: [
    UserModule,
    AuthModule,
    WorkspaceModule,
    PageModule,
    StorageModule.forRootAsync({
      imports: [EnvironmentModule],
    }),
    AttachmentModule,
    CommentModule,
    SearchModule,
    SpaceModule,
    GroupModule,
    CaslModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DomainMiddleware)
      .exclude({ path: 'auth/setup', method: RequestMethod.POST })
      .forRoutes('*');
  }
}
