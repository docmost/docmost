"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollabProxySocket = void 0;
const tseep_1 = require("tseep");
class CollabProxySocket extends tseep_1.EventEmitter {
    constructor(pub, pack, replyTo, serverChannel, socketId) {
        super();
        this.readyState = 1;
        this.replyTo = replyTo;
        this.socketId = socketId;
        this.serverChannel = serverChannel;
        this.pub = pub;
        this.pack = pack;
        this.once('close', () => {
            this.readyState = 3;
        });
    }
    publish(msg) {
        this.pub.publish(this.replyTo, this.pack(msg));
    }
    close(code, reason) {
        if (this.readyState !== 1)
            return;
        const msg = {
            type: 'close',
            code,
            reason,
            socketId: this.socketId,
        };
        this.publish(msg);
    }
    ping() {
        if (this.readyState !== 1)
            return;
        const msg = {
            type: 'ping',
            socketId: this.socketId,
            replyTo: this.serverChannel,
        };
        this.publish(msg);
    }
    send(message) {
        if (this.readyState !== 1)
            return;
        const msg = {
            type: 'send',
            socketId: this.socketId,
            message,
        };
        this.publish(msg);
    }
}
exports.CollabProxySocket = CollabProxySocket;
//# sourceMappingURL=collab-proxy-socket.js.map