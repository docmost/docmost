import { Global, Module } from '@nestjs/common';
import { OutboundAgentFactory } from './outbound-agent.factory';
import { OutboundUrlGuard } from './outbound-url.guard';

@Global()
@Module({
  providers: [OutboundUrlGuard, OutboundAgentFactory],
  exports: [OutboundUrlGuard, OutboundAgentFactory],
})
export class OutboundModule {}
