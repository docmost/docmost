import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnvironmentService } from '../../integrations/environment/environment.service';
declare const JwtAuthGuard_base: import("@nestjs/passport").Type<import("@nestjs/passport").IAuthGuard>;
export declare class JwtAuthGuard extends JwtAuthGuard_base {
    private reflector;
    private environmentService;
    constructor(reflector: Reflector, environmentService: EnvironmentService);
    canActivate(context: ExecutionContext): boolean | Promise<boolean> | import("rxjs").Observable<boolean>;
    handleRequest(err: any, user: any, info: any, ctx: ExecutionContext): any;
    setJoinedWorkspacesCookie(user: any, ctx: ExecutionContext): void;
}
export {};
