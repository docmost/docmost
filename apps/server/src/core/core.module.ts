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
import { AttachmentModule } from './attachment/attachment.module';
import { CommentModule } from './comment/comment.module';
import { SearchModule } from './search/search.module';
import { SpaceModule } from './space/space.module';
import { GroupModule } from './group/group.module';
import { CaslModule } from './casl/casl.module';
import { DomainMiddleware } from '../common/middlewares/domain.middleware';
import { ShareModule } from './share/share.module';

@Module({
  imports: [
    UserModule,
    AuthModule,
    WorkspaceModule,
    PageModule,
    AttachmentModule,
    CommentModule,
    SearchModule,
    SpaceModule,
    GroupModule,
    CaslModule,
    ShareModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(DomainMiddleware)
      .exclude(
        { path: 'auth/setup', method: RequestMethod.POST },
        { path: 'health', method: RequestMethod.GET },
        { path: 'health/live', method: RequestMethod.GET },
        { path: 'billing/stripe/webhook', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
