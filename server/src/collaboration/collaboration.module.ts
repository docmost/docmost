import { Module } from '@nestjs/common';
import { UserModule } from '../core/user/user.module';
import { AuthModule } from '../core/auth/auth.module';
import { CollaborationGateway } from './collaboration.gateway';
import { AuthenticationExtension } from './extensions/authentication.extension';
import { PersistenceExtension } from './extensions/persistence.extension';
import { PageModule } from '../core/page/page.module';

@Module({
  providers: [
    CollaborationGateway,
    AuthenticationExtension,
    PersistenceExtension,
  ],
  imports: [UserModule, AuthModule, PageModule],
})
export class CollaborationModule {}
