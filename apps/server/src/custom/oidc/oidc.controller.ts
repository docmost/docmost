import { Controller, Get, Req, Res, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response, Request } from 'express';
import { OidcService } from './services/oidc.service';
import { TokenService } from '../../core/auth/services/token.service';
import { DomainService } from '../../integrations/environment/domain.service';

@Controller('auth/oidc')
export class OidcController {
    constructor(
        private readonly oidcService: OidcService,
        private readonly tokenService: TokenService,
        private readonly domainService: DomainService,
    ) { }

    /**
     * 初始化 OIDC 登录流程
     * GET /auth/oidc/login?workspace=<workspace_id>
     */
    @Get('login')
    async initiateLogin(
        @Query('workspace') workspaceId: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        if (!workspaceId) {
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        // 获取 OIDC 提供商配置
        const provider = await this.oidcService.getOidcProvider(workspaceId);
        if (!provider) {
            return res.status(404).json({ message: 'OIDC provider not found' });
        }

        // 验证配置
        const isValid = await this.oidcService.validateOidcConfig(provider);
        if (!isValid) {
            return res.status(400).json({ message: 'OIDC provider configuration is incomplete' });
        }

        // 将 workspace 和 provider 信息存储到 session 或 state
        // 这里简化处理，实际应该使用 session 或加密 state
        req['workspaceId'] = workspaceId;
        req['authProviderId'] = provider.id;

        // 重定向到 OIDC 提供商
        // 实际实现需要构建授权URL
        const callbackUrl = `${this.domainService.getUrl()}/auth/oidc/callback`;
        const authorizationUrl = `${provider.oidcIssuer}/authorize?client_id=${provider.oidcClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid email profile&state=${workspaceId}`;

        return res.redirect(authorizationUrl);
    }

    /**
     * OIDC 回调处理
     * GET /auth/oidc/callback
     */
    @Get('callback')
    @UseGuards(AuthGuard('oidc'))
    async handleCallback(@Req() req: any, @Res() res: Response) {
        try {
            const user = req.user;

            if (!user) {
                return res.status(401).json({ message: 'Authentication failed' });
            }

            // 生成 JWT token
            const authToken = await this.tokenService.generateAccessToken(user);

            // 重定向到前端，带上 token
            const frontendUrl = this.domainService.getUrl();
            return res.redirect(`${frontendUrl}/auth/callback?token=${authToken.token}`);
        } catch (error) {
            return res.status(500).json({
                message: 'Authentication failed',
                error: error.message
            });
        }
    }

    /**
     * 获取工作区的 OIDC 配置（用于前端显示登录按钮）
     * GET /auth/oidc/config?workspace=<workspace_id>
     */
    @Get('config')
    async getConfig(@Query('workspace') workspaceId: string) {
        if (!workspaceId) {
            return { enabled: false };
        }

        const provider = await this.oidcService.getOidcProvider(workspaceId);

        return {
            enabled: !!provider,
            providerName: provider?.name || 'SSO',
        };
    }
}
