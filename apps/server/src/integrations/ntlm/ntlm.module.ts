import { Module } from '@nestjs/common';
import { NTLMController } from './ntlm.controller';
import { NTLMService } from './ntlm.service';

@Module({
    controllers: [NTLMController],
    providers: [NTLMService]
  })
  export class NTLMModule {}
