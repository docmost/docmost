import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { EnvironmentService } from '../environment/environment.service';
import * as ldap from 'ldapjs';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { TokensDto } from 'src/core/auth/dto/tokens.dto';
import { TokenService } from 'src/core/auth/services/token.service';
import { AuthService } from 'src/core/auth/services/auth.service';

@Injectable()
export class NTLMService {
  constructor(
    private readonly environmentService: EnvironmentService,
    private authService: AuthService,
    private tokenService: TokenService,
    private userRepo: UserRepo,
  ) {}

  createClient = (domain: string) =>
    ldap.createClient({
      url: 'ldap://' + domain + this.environmentService.getLdapDomainSuffix(),
    });

  // Promisified version of ldap.Client.bind
  bindAsync = (client: ldap.Client): Promise<void> => {
    return new Promise((resolve, reject) => {
      client.bind(
        this.environmentService.getLdapUsername(),
        this.environmentService.getLdapPassword(),
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        },
      );
    });
  };

  // Promisified version of client.search
  searchAsync = (
    client: ldap.Client,
    options: ldap.SearchOptions,
  ): Promise<any[]> => {
    const baseDN: string = this.environmentService.getLdapBaseDn();
    return new Promise((resolve, reject) => {
      const entries: any[] = [];

      client.search(baseDN, options, (err, res) => {
        if (err) {
          reject(err);
        }

        res.on('searchEntry', (entry) => {
          const attributes = Object.fromEntries(
            entry.attributes.map(({ type, values }) => [
              type,
              values.length > 1 ? values : values[0],
            ]),
          );
          entries.push(attributes);
        });

        res.on('end', () => {
          resolve(entries);
        });

        res.on('error', (error) => {
          reject(error);
        });
      });
    });
  };

  async login(name: string, email: string, workspaceId: string) {
    const user = await this.userRepo.findByEmail(email, workspaceId, false);

    if (!user) {
      const tokensR = await this.authService.register(
        {
          name,
          email,
          password: this.generateRandomPassword(12),
        },
        workspaceId,
      );

      return tokensR;
    }

    user.lastLoginAt = new Date();
    await this.userRepo.updateLastLogin(user.id, workspaceId);

    const tokens: TokensDto = await this.tokenService.generateTokens(user);
    return { tokens };
  }

  generateRandomPassword(length: number): string {
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      password += characters[randomIndex];
    }

    return password;
  }
}
