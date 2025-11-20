import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AuthProvider, User } from '@docmost/db/types/entity.types';
import { OidcProfile } from '../types/oidc.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { hashPassword } from '../../../../common/helpers';
import { executeTx } from '@docmost/db/utils';

@Injectable()
export class OidcService {
    constructor(
        @InjectKysely() private readonly db: KyselyDB,
        private readonly userRepo: UserRepo,
    ) { }

    /**
     * 获取工作区的 OIDC 提供商配置
     */
    async getOidcProvider(workspaceId: string): Promise<AuthProvider | undefined> {
        return await this.db
            .selectFrom('authProviders')
            .selectAll()
            .where('workspaceId', '=', workspaceId)
            .where('type', '=', 'oidc')
            .where('isEnabled', '=', true)
            .where('deletedAt', 'is', null)
            .executeTakeFirst();
    }

    /**
     * 通过 OIDC profile 查找或创建用户
     */
    async findOrCreateUser(
        oidcProfile: OidcProfile,
        authProviderId: string,
        workspaceId: string,
    ): Promise<User> {
        // 1. 尝试通过 auth_accounts 查找现有用户
        const authAccount = await this.db
            .selectFrom('authAccounts')
            .selectAll()
            .where('providerUserId', '=', oidcProfile.sub)
            .where('authProviderId', '=', authProviderId)
            .where('workspaceId', '=', workspaceId)
            .where('deletedAt', 'is', null)
            .executeTakeFirst();

        if (authAccount) {
            // 用户已存在，返回用户信息
            const user = await this.userRepo.findById(authAccount.userId, workspaceId);
            if (!user || user.deletedAt) {
                throw new UnauthorizedException('User account is disabled');
            }

            // 更新最后登录时间
            await this.userRepo.updateLastLogin(user.id, workspaceId);
            return user;
        }

        // 2. 检查是否允许注册
        const provider = await this.getOidcProvider(workspaceId);
        if (!provider || !provider.allowSignup) {
            throw new UnauthorizedException(
                'SSO user registration is not enabled for this workspace',
            );
        }

        // 3. 创建新用户
        return await this.createUserFromOidc(oidcProfile, authProviderId, workspaceId);
    }

    /**
     * 从 OIDC profile 创建新用户
     */
    private async createUserFromOidc(
        oidcProfile: OidcProfile,
        authProviderId: string,
        workspaceId: string,
    ): Promise<User> {
        return await executeTx(this.db, async (trx) => {
            // 创建用户
            const userName = oidcProfile.name || oidcProfile.preferred_username || oidcProfile.email.split('@')[0];

            // 生成随机密码（用户通过 SSO 登录，不会使用此密码）
            const randomPassword = Math.random().toString(36).slice(-12);
            const hashedPassword = await hashPassword(randomPassword);

            const [user] = await trx
                .insertInto('users')
                .values({
                    email: oidcProfile.email,
                    name: userName,
                    password: hashedPassword,
                    hasGeneratedPassword: true,
                    workspaceId: workspaceId,
                    emailVerifiedAt: new Date(), // OIDC 用户默认已验证邮箱
                    lastLoginAt: new Date(),
                })
                .returningAll()
                .execute();

            // 创建 auth_account 关联
            await trx
                .insertInto('authAccounts')
                .values({
                    userId: user.id,
                    providerUserId: oidcProfile.sub,
                    authProviderId: authProviderId,
                    workspaceId: workspaceId,
                })
                .execute();

            return user;
        });
    }

    /**
     * 验证 OIDC 配置是否完整
     */
    async validateOidcConfig(provider: AuthProvider): Promise<boolean> {
        if (!provider.oidcIssuer || !provider.oidcClientId || !provider.oidcClientSecret) {
            return false;
        }
        return true;
    }
}
