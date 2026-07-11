import { Strategy } from 'passport-jwt';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { JwtApiKeyPayload, JwtPayload } from '../dto/jwt-payload';
import { WorkspaceRepo } from "../../../database/repos/workspace/workspace.repo";
import { UserRepo } from "../../../database/repos/user/user.repo";
import { UserSessionRepo } from "../../../database/repos/session/user-session.repo";
import { SessionActivityService } from '../../session/session-activity.service';
import { ModuleRef } from '@nestjs/core';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private userRepo;
    private workspaceRepo;
    private userSessionRepo;
    private sessionActivityService;
    private readonly environmentService;
    private moduleRef;
    private logger;
    constructor(userRepo: UserRepo, workspaceRepo: WorkspaceRepo, userSessionRepo: UserSessionRepo, sessionActivityService: SessionActivityService, environmentService: EnvironmentService, moduleRef: ModuleRef);
    validate(req: any, payload: JwtPayload | JwtApiKeyPayload): Promise<any>;
    private validateApiKey;
}
export {};
