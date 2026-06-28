import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';

@Module({
  controllers: [McpController],
})
export class McpModule {}
