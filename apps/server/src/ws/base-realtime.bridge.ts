import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Server, Socket } from 'socket.io';

@Injectable()
export class BaseRealtimeBridge {
  private readonly logger = new Logger(BaseRealtimeBridge.name);
  private resolved = false;
  private svc: any = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  protected loadServiceClass(): any {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('../ee/base/realtime/base-ws.service').BaseWsService;
    } catch {
      this.logger.debug(
        'Base realtime requested but enterprise module not bundled in this build',
      );
      return null;
    }
  }

  private resolve(): any {
    if (this.resolved) return this.svc;
    this.resolved = true;
    const ServiceClass = this.loadServiceClass();
    if (!ServiceClass) return null;
    this.svc = this.moduleRef.get(ServiceClass, { strict: false });
    return this.svc;
  }

  setServer(server: Server): void {
    this.resolve()?.setServer(server);
  }

  isBaseEvent(data: any): boolean {
    return this.resolve()?.isBaseEvent(data) ?? false;
  }

  async handleInbound(client: Socket, data: any): Promise<void> {
    await this.resolve()?.handleInbound(client, data);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    await this.resolve()?.handleDisconnect(client);
  }
}
