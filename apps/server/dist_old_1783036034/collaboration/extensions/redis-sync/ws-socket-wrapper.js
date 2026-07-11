"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsSocketWrapper = void 0;
const events_1 = require("events");
class WsSocketWrapper extends events_1.EventEmitter {
    constructor(ws) {
        super();
        this.readyState = 1;
        this.ws = ws;
        this.once('close', () => {
            this.readyState = 3;
        });
    }
    close(code, reason) {
        if (this.readyState !== 1)
            return;
        this.readyState = 3;
        try {
            this.ws.close(code, reason);
        }
        catch (e) {
        }
    }
    ping() {
        if (this.readyState !== 1)
            return;
        try {
            this.ws.ping();
        }
        catch (e) {
        }
    }
    send(message) {
        if (this.readyState !== 1)
            return;
        try {
            this.ws.send(message);
        }
        catch (e) {
        }
    }
}
exports.WsSocketWrapper = WsSocketWrapper;
//# sourceMappingURL=ws-socket-wrapper.js.map