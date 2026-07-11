"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollabWsAdapter = void 0;
const ws_1 = require("ws");
class CollabWsAdapter {
    constructor() {
        this.wss = new ws_1.WebSocketServer({ noServer: true });
    }
    handleUpgrade(path, httpServer) {
        httpServer.on('upgrade', (request, socket, head) => {
            try {
                const baseUrl = 'ws://' + request.headers.host + '/';
                const pathname = new URL(request.url, baseUrl).pathname;
                if (pathname === path) {
                    this.wss.handleUpgrade(request, socket, head, (ws) => {
                        this.wss.emit('connection', ws, request);
                    });
                }
                else if (pathname === '/socket.io/') {
                    return;
                }
                else {
                    socket.destroy();
                }
            }
            catch (err) {
                socket.end('HTTP/1.1 400\r\n' + err.message);
            }
        });
        return this.wss;
    }
    close() {
        try {
            this.wss.close();
        }
        catch (err) {
            console.error(err);
        }
    }
    destroy() {
        try {
            this.wss.close();
            this.wss.clients.forEach((client) => {
                client.terminate();
            });
        }
        catch (err) {
            console.error(err);
        }
    }
}
exports.CollabWsAdapter = CollabWsAdapter;
//# sourceMappingURL=collab-ws.adapter.js.map