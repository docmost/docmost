import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class BaseWsService {
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  isBaseEvent(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const event = (data as { event?: string }).event;
    return typeof event === 'string' && event.startsWith('base:');
  }

  async handleInbound(_client: Socket, _data: unknown): Promise<void> {
    // Realtime collaboration can be extended when needed.
  }

  async handleDisconnect(_client: Socket): Promise<void> {
    // No-op stub for self-hosted unlock build.
  }
}
