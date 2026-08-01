import { WebSocketServer } from 'ws';

export class CollabWsAdapter {
  private readonly wss: WebSocketServer;

  constructor() {
    // Bound what a single frame may buffer before any handler sees it. The
    // e2ee relay checks a 10 MiB limit itself, but only after the frame has
    // been fully received; this refuses oversized frames at the protocol
    // level. Plaintext collaboration sends incremental Yjs updates, which are
    // orders of magnitude smaller than this.
    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: 16 * 1024 * 1024,
    });
  }

  handleUpgrade(path: string, httpServer: any) {
    httpServer.on('upgrade', (request: any, socket: any, head: any) => {
      try {
        const baseUrl = 'ws://' + request.headers.host + '/';
        const pathname = new URL(request.url, baseUrl).pathname;

        if (pathname === path) {
          this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss.emit('connection', ws, request);
          });
        } else if (pathname === '/socket.io/') {
          return;
        } else {
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
