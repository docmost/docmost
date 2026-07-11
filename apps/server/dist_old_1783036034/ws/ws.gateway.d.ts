import { OnGatewayConnection, OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../core/auth/services/token.service';
import { OnModuleDestroy } from '@nestjs/common';
import { SpaceMemberRepo } from "../database/repos/space/space-member.repo";
import { WsService } from './ws.service';
export declare class WsGateway implements OnGatewayConnection, OnGatewayInit, OnModuleDestroy {
    private tokenService;
    private spaceMemberRepo;
    private wsService;
    server: Server;
    constructor(tokenService: TokenService, spaceMemberRepo: SpaceMemberRepo, wsService: WsService);
    afterInit(server: Server): void;
    handleConnection(client: Socket, ...args: any[]): Promise<void>;
    handleMessage(client: Socket, data: any): Promise<void>;
    onModuleDestroy(): void;
}
