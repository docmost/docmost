import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';
import { ApiKeyRepo } from './api-key.repo';
import { TokenModule } from '../../core/auth/token.module';

@Module({
  imports: [TokenModule],
  providers: [ApiKeyService, ApiKeyRepo],
  controllers: [ApiKeyController],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
