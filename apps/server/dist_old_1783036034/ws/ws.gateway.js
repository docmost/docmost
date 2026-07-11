"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const token_service_1 = require("../core/auth/services/token.service");
const jwt_payload_1 = require("../core/auth/dto/jwt-payload");
const space_member_repo_1 = require("../database/repos/space/space-member.repo");
const ws_service_1 = require("./ws.service");
const ws_utils_1 = require("./ws.utils");
const cookie = require("cookie");
let WsGateway = class WsGateway {
    constructor(tokenService, spaceMemberRepo, wsService) {
        this.tokenService = tokenService;
        this.spaceMemberRepo = spaceMemberRepo;
        this.wsService = wsService;
    }
    afterInit(server) {
        this.wsService.setServer(server);
    }
    async handleConnection(client, ...args) {
        try {
            const cookies = cookie.parse(client.handshake.headers.cookie);
            const token = await this.tokenService.verifyJwt(cookies['authToken'], jwt_payload_1.JwtType.ACCESS);
            const userId = token.sub;
            const workspaceId = token.workspaceId;
            client.data.userId = userId;
            const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(userId);
            const userRoom = (0, ws_utils_1.getUserRoomName)(userId);
            const workspaceRoom = `workspace-${workspaceId}`;
            const spaceRooms = userSpaceIds.map((id) => (0, ws_utils_1.getSpaceRoomName)(id));
            client.join([userRoom, workspaceRoom, ...spaceRooms]);
        }
        catch (err) {
            client.emit('Unauthorized');
            client.disconnect();
        }
    }
    async handleMessage(client, data) {
        if (this.wsService.isTreeEvent(data)) {
            await this.wsService.handleTreeEvent(client, data);
        }
    }
    onModuleDestroy() {
        if (this.server) {
            this.server.close();
        }
    }
};
exports.WsGateway = WsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], WsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Promise)
], WsGateway.prototype, "handleMessage", null);
exports.WsGateway = WsGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: '*' },
        transports: ['websocket'],
    }),
    __metadata("design:paramtypes", [token_service_1.TokenService,
        space_member_repo_1.SpaceMemberRepo,
        ws_service_1.WsService])
], WsGateway);
//# sourceMappingURL=ws.gateway.js.map