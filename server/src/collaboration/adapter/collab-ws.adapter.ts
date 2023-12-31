import { WebSocketServer } from 'ws';

export class CollabWsAdapter {
  private readonly wss: WebSocketServer;

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
  }

  handleUpgrade(path: string, httpServer) {
    httpServer.on('upgrade', (request, socket, head) => {
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
        socket.end('HTTP/1.1 400\r\n' + err.message);
      }
    });

    return this.wss;
  }

  public destroy() {
    try {
      this.wss.clients.forEach((client) => {
        client.terminate();
      });
      this.wss.close();
    } catch (err) {
      console.error(err);
    }
  }
}
