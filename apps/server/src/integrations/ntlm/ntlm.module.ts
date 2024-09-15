import { Module } from '@nestjs/common';
import { NTLMController } from './ntlm.controller';
import { NTLMService } from './ntlm.service';
import { TokenModule } from 'src/core/auth/token.module';
import { WorkspaceModule } from 'src/core/workspace/workspace.module';
import { AuthModule } from 'src/core/auth/auth.module';

@Module({
  imports: [TokenModule, WorkspaceModule, AuthModule],
  controllers: [NTLMController],
  providers: [NTLMService],
})
export class NTLMModule {}
