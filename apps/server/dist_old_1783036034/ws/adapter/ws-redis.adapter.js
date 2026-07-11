"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsRedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
const helpers_1 = require("../../common/helpers");
class WsRedisIoAdapter extends platform_socket_io_1.IoAdapter {
    async connectToRedis() {
        this.redisConfig = (0, helpers_1.parseRedisUrl)(process.env.REDIS_URL);
        const options = {
            family: this.redisConfig.family,
            retryStrategy: (0, helpers_1.createRetryStrategy)(),
        };
        const pubClient = new ioredis_1.default(process.env.REDIS_URL, options);
        const subClient = new ioredis_1.default(process.env.REDIS_URL, options);
        pubClient.on('error', (err) => () => { });
        subClient.on('error', (err) => () => { });
        this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, options);
        server.adapter(this.adapterConstructor);
        return server;
    }
}
exports.WsRedisIoAdapter = WsRedisIoAdapter;
//# sourceMappingURL=ws-redis.adapter.js.map