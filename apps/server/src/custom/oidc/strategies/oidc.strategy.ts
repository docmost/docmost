import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Client, Issuer, TokenSet, UserinfoResponse } from 'openid-client';
import { OidcService } from '../services/oidc.service';
import { OidcProfile } from '../types/oidc.types';

@Injectable()
export class OidcStrategy extends PassportStrategy(Strategy, 'oidc') {
    constructor(private oidcService: OidcService) {
        super({
            passReqToCallback: true,
        });
    }

    /**
     * 验证 OIDC callback
     */
    async validate(
        req: any,
        tokenset: TokenSet,
        done: (err: any, user?: any) => void,
    ): Promise<any> {
        try {
            const workspaceId = req.workspaceId; // 从请求中获取 workspace ID
            const authProviderId = req.authProviderId; // 从请求中获取 provider ID

            if (!workspaceId || !authProviderId) {
                return done(new UnauthorizedException('Invalid request context'));
            }

            // 获取用户信息
            const claims = tokenset.claims();

            const oidcProfile: OidcProfile = {
                sub: claims.sub,
                email: claims.email as string,
                name: claims.name as string,
                preferred_username: claims.preferred_username as string,
                given_name: claims.given_name as string,
                family_name: claims.family_name as string,
            };

            if (!oidcProfile.email) {
                return done(new UnauthorizedException('Email not provided by OIDC provider'));
            }

            // 查找或创建用户
            const user = await this.oidcService.findOrCreateUser(
                oidcProfile,
                authProviderId,
                workspaceId,
            );

            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
}
