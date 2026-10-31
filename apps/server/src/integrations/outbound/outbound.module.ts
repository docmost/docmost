import { Global, Module } from '@nestjs/common';
import { OutboundAgentFactory } from './outbound-agent.factory.js';
import { OutboundUrlGuard } from './outbound-url.guard.js';

@Global()
@Module({
  providers: [OutboundUrlGuard, OutboundAgentFactory],
  exports: [OutboundUrlGuard, OutboundAgentFactory],
})
export class OutboundModule {}
