import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { WorkspaceModule } from './workspace/workspace.module.js';
import { PageModule } from './page/page.module.js';
import { AttachmentModule } from './attachment/attachment.module.js';
import { CommentModule } from './comment/comment.module.js';
import { SearchModule } from './search/search.module.js';
import { SpaceModule } from './space/space.module.js';
import { GroupModule } from './group/group.module.js';
import { CaslModule } from './casl/casl.module.js';
import { PageAccessModule } from './page/page-access/page-access.module.js';
import { DomainMiddleware } from '../common/middlewares/domain.middleware.js';
import { AuditContextMiddleware } from '../common/middlewares/audit-context.middleware.js';
import { ShareModule } from './share/share.module.js';
import { PublicSpaceModule } from './public-space/public-space.module.js';
import { LabelModule } from './label/label.module.js';
import { NotificationModule } from './notification/notification.module.js';
import { WatcherModule } from './watcher/watcher.module.js';
import { IntegrationModule } from './integration/integration.module.js';
import { GitHubModule } from './integration/providers/github/github.module.js';
import { FigmaModule } from './integration/providers/figma/figma.module.js';
import { LinearModule } from './integration/providers/linear/linear.module.js';
import { FavoriteModule } from './favorite/favorite.module.js';
import { SessionModule } from './session/session.module.js';
import { ClsMiddleware } from 'nestjs-cls';

@Module({
  imports: [
    UserModule,
    AuthModule,
    WorkspaceModule,
    PageModule,
    AttachmentModule,
    CommentModule,
    FavoriteModule,
    SearchModule,
    SpaceModule,
    GroupModule,
    CaslModule,
    PageAccessModule,
    ShareModule,
    PublicSpaceModule,
    LabelModule,
    NotificationModule,
    WatcherModule,
    IntegrationModule,
    GitHubModule,
    FigmaModule,
    LinearModule,
    SessionModule,
  ],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const excludedRoutes = [
      { path: 'auth/setup', method: RequestMethod.POST },
      { path: 'health', method: RequestMethod.GET },
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'billing/stripe/webhook', method: RequestMethod.POST },
      { path: 'integrations/oauth/*/callback', method: RequestMethod.GET },
    ];

    consumer
      .apply(DomainMiddleware)
      .exclude(...excludedRoutes)
      .forRoutes('*');

    consumer
      .apply(AuditContextMiddleware)
      .exclude(...excludedRoutes)
      .forRoutes('*');
  }
}
