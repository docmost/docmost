import { Logger } from '@nestjs/common';
import { WebSocketServer } from 'ws';

export class CollabWsAdapter {
  private readonly logger = new Logger(CollabWsAdapter.name);
  private readonly wss: WebSocketServer;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  handleUpgrade(path: string, httpServer: any) {
    httpServer.on('upgrade', (request: any, socket: any, head: any) => {
      try {
        const baseUrl = 'ws://' + request.headers.host + '/';
        const pathname = new URL(request.url, baseUrl).pathname;

        if (pathname === path) {
          // Silence here while a client reports "connection lost" means the
          // upgrade never reached the app — look at the reverse proxy.
          // See docs/reverse-proxy.md
          this.logger.debug(
            `Upgrade accepted on ${pathname} from ${
              request.headers['x-forwarded-for'] ??
              request.socket?.remoteAddress ??
              'unknown'
            }`,
          );
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        } else if (pathname === '/socket.io/') {
          return;
        } else {
          this.logger.warn(
            `Rejected websocket upgrade on ${pathname} (expected ${path})`,
          );
          socket.destroy();
        }
      } catch (err) {
        socket.end('HTTP/1.1 400\r\n' + (err as Error).message);
      }
    });

    return this.wss;
  }

  public close() {
    try {
      this.wss.close();
    } catch (err) {
      console.error(err);
    }
  }

  public destroy() {
    try {
      this.wss.close();
      this.wss.clients.forEach((client) => {
        client.terminate();
      });
    } catch (err) {
      console.error(err);
    }
  }
}
