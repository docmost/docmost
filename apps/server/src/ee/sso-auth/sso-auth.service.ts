import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthProviderRepo } from '../sso/auth-provider.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { SessionService } from '../../core/session/session.service';
import { Client } from 'ldapts';
import { UserRole } from '../../common/helpers/types/permission';
import { nanoIdGen } from '../../common/helpers';

@Injectable()
export class SsoAuthService {
  constructor(
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly userRepo: UserRepo,
    private readonly sessionService: SessionService,
  ) {}

  async ldapLogin(
    providerId: string,
    data: { username: string; password: string },
    workspaceId: string,
  ): Promise<string> {
    const provider = await this.authProviderRepo.findById(
      providerId,
      workspaceId,
    );
    if (!provider || provider.type !== 'ldap' || !provider.isEnabled) {
      throw new NotFoundException('LDAP provider not found');
    }
    if (!provider.ldapUrl || !provider.ldapBaseDn) {
      throw new BadRequestException('LDAP provider is not configured');
    }

    const client = new Client({ url: provider.ldapUrl });
    try {
      if (provider.ldapBindDn && provider.ldapBindPassword) {
        await client.bind(provider.ldapBindDn, provider.ldapBindPassword);
      }
      const filter =
        provider.ldapUserSearchFilter?.replace('{{username}}', data.username) ||
        `(uid=${data.username})`;
      const { searchEntries } = await client.search(provider.ldapBaseDn, {
        scope: 'sub',
        filter,
        attributes: ['mail', 'cn', 'uid'],
      });
      if (!searchEntries.length) {
        throw new UnauthorizedException('Invalid credentials');
      }
      const entry = searchEntries[0];
      await client.bind(entry.dn, data.password);

      const email =
        (entry.mail as string) ||
        `${data.username}@${workspaceId}.ldap.local`;
      let user = await this.userRepo.findByEmail(email, workspaceId);
      if (!user && provider.allowSignup) {
        user = await this.userRepo.insertUser({
          email,
          name: (entry.cn as string) || data.username,
          password: nanoIdGen(16),
          workspaceId,
          role: UserRole.MEMBER,
        });
      }
      if (!user) {
        throw new UnauthorizedException('User not provisioned');
      }

      return this.sessionService.createSessionAndToken(user);
    } finally {
      await client.unbind().catch(() => undefined);
    }
  }
}
