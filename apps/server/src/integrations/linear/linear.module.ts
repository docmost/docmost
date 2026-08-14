import { Module } from '@nestjs/common';
import { LinearController } from './linear.controller';
import { LinearApiService } from './linear-api.service';
import { LinearOAuth2Provider } from './linear.provider';

// Registers the Linear provider and its data endpoints; the global
// Oauth2Module provides the connection lifecycle.
@Module({
  controllers: [LinearController],
  providers: [LinearApiService, LinearOAuth2Provider],
  exports: [LinearApiService],
})
export class LinearModule {}
