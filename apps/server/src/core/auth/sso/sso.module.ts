import { Module } from '@nestjs/common';
import { TokenModule } from '../token.module';
import { WorkspaceModule } from '../../workspace/workspace.module';
import { GroupModule } from '../../group/group.module';
import { GoogleSsoController } from './google-sso.controller';
import { SsoConfigController } from './sso-config.controller';
import { GoogleOauthService } from './services/google-oauth.service';
import { GoogleGroupsService } from './services/google-groups.service';
import { GoogleProvisioningService } from './services/google-provisioning.service';
import { SsoConfigService } from './services/sso-config.service';

@Module({
  imports: [TokenModule, WorkspaceModule, GroupModule],
  controllers: [GoogleSsoController, SsoConfigController],
  providers: [
    GoogleOauthService,
    GoogleGroupsService,
    GoogleProvisioningService,
    SsoConfigService,
  ],
  exports: [GoogleGroupsService, GoogleProvisioningService],
})
export class SsoModule {}
