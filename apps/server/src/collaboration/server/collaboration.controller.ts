import { Controller, Get } from '@nestjs/common';
import { CollaborationGateway } from '../collaboration.gateway';

@Controller('collab')
export class CollaborationController {
  constructor(private readonly collaborationGateway: CollaborationGateway) {}

  @Get('stats')
  async getStats() {
    return {
      connections: this.collaborationGateway.getConnectionCount(),
      documents: this.collaborationGateway.getDocumentCount(),
    };
  }
}
