import { Global, Module } from '@nestjs/common';
import { Oauth2Service } from './oauth2.service';
import { Oauth2ProviderRegistry } from './oauth2-provider.registry';
import { Oauth2Controller } from './oauth2.controller';

// Generic OAuth2 plumbing. Global so provider modules can inject
// Oauth2Service and Oauth2ProviderRegistry without importing it.
@Global()
@Module({
  controllers: [Oauth2Controller],
  providers: [Oauth2Service, Oauth2ProviderRegistry],
  exports: [Oauth2Service, Oauth2ProviderRegistry],
})
export class Oauth2Module {}
