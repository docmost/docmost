import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { User } from "../../../database/types/entity.types";
export declare class TokenService {
    private jwtService;
    private environmentService;
    constructor(jwtService: JwtService, environmentService: EnvironmentService);
    generateAccessToken(user: User, sessionId: string): Promise<string>;
    generateCollabToken(user: User, workspaceId: string): Promise<string>;
    generateExchangeToken(userId: string, workspaceId: string): Promise<string>;
    generateAttachmentToken(opts: {
        attachmentId: string;
        pageId: string;
        workspaceId: string;
    }): Promise<string>;
    generateMfaToken(user: User, workspaceId: string): Promise<string>;
    generateApiToken(opts: {
        apiKeyId: string;
        user: User;
        workspaceId: string;
        expiresIn?: StringValue | number;
    }): Promise<string>;
    generatePdfRenderToken(pageId: string, workspaceId: string): Promise<string>;
    generatePdfExportDownloadToken(fileTaskId: string, workspaceId: string): Promise<string>;
    verifyJwt(token: string, tokenType: string): Promise<any>;
}
