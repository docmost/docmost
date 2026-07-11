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
exports.TokenService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const environment_service_1 = require("../../../integrations/environment/environment.service");
const jwt_payload_1 = require("../dto/jwt-payload");
const helpers_1 = require("../../../common/helpers");
let TokenService = class TokenService {
    constructor(jwtService, environmentService) {
        this.jwtService = jwtService;
        this.environmentService = environmentService;
    }
    async generateAccessToken(user, sessionId) {
        if ((0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.ForbiddenException();
        }
        const payload = {
            sub: user.id,
            email: user.email,
            workspaceId: user.workspaceId,
            type: jwt_payload_1.JwtType.ACCESS,
            sessionId,
        };
        return this.jwtService.sign(payload);
    }
    async generateCollabToken(user, workspaceId) {
        if ((0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.ForbiddenException();
        }
        const payload = {
            sub: user.id,
            workspaceId,
            type: jwt_payload_1.JwtType.COLLAB,
        };
        const expiresIn = '24h';
        return this.jwtService.sign(payload, { expiresIn });
    }
    async generateExchangeToken(userId, workspaceId) {
        const payload = {
            sub: userId,
            workspaceId: workspaceId,
            type: jwt_payload_1.JwtType.EXCHANGE,
        };
        return this.jwtService.sign(payload, { expiresIn: '10s' });
    }
    async generateAttachmentToken(opts) {
        const { attachmentId, pageId, workspaceId } = opts;
        const payload = {
            attachmentId: attachmentId,
            pageId: pageId,
            workspaceId: workspaceId,
            type: jwt_payload_1.JwtType.ATTACHMENT,
        };
        return this.jwtService.sign(payload, { expiresIn: '1h' });
    }
    async generateMfaToken(user, workspaceId) {
        if ((0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.ForbiddenException();
        }
        const payload = {
            sub: user.id,
            workspaceId,
            type: jwt_payload_1.JwtType.MFA_TOKEN,
        };
        return this.jwtService.sign(payload, { expiresIn: '5m' });
    }
    async generateApiToken(opts) {
        const { apiKeyId, user, workspaceId, expiresIn } = opts;
        if ((0, helpers_1.isUserDisabled)(user)) {
            throw new common_1.ForbiddenException();
        }
        const payload = {
            sub: user.id,
            apiKeyId: apiKeyId,
            workspaceId,
            type: jwt_payload_1.JwtType.API_KEY,
        };
        return this.jwtService.sign(payload, expiresIn ? { expiresIn } : {});
    }
    async generatePdfRenderToken(pageId, workspaceId) {
        const payload = {
            pageId,
            workspaceId,
            type: jwt_payload_1.JwtType.PDF_RENDER,
        };
        return this.jwtService.sign(payload, { expiresIn: '60s' });
    }
    async generatePdfExportDownloadToken(fileTaskId, workspaceId) {
        const payload = {
            fileTaskId,
            workspaceId,
            type: jwt_payload_1.JwtType.PDF_EXPORT_DOWNLOAD,
        };
        return this.jwtService.sign(payload, { expiresIn: '1h' });
    }
    async verifyJwt(token, tokenType) {
        const payload = await this.jwtService.verifyAsync(token, {
            secret: this.environmentService.getAppSecret(),
        });
        if (payload.type !== tokenType) {
            throw new common_1.UnauthorizedException('Invalid JWT token. Token type does not match.');
        }
        return payload;
    }
};
exports.TokenService = TokenService;
exports.TokenService = TokenService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        environment_service_1.EnvironmentService])
], TokenService);
//# sourceMappingURL=token.service.js.map