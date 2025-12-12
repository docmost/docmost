import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { Client, Issuer, generators } from 'openid-client';
import { isEmail } from 'class-validator';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { User, InsertableUser } from '@docmost/db/types/entity.types';
import { AuthProviderRepo } from '../../../database/repos/auth-provider/auth-provider.repo';
import { UserRepo } from '../../../database/repos/user/user.repo';
import { AuthAccountRepo } from '../../../database/repos/auth-account/auth-account.repo';
import { TokenService } from './token.service';
import { executeTx } from '@docmost/db/utils';
import { validateAllowedEmail } from '../auth.util';
import { UserRole } from '../../../common/helpers/types/permission';
import { GroupUserRepo } from '@docmost/db/repos/group/group-user.repo';
import { WorkspaceService } from '../../workspace/services/workspace.service';
import { StorageService } from '../../../integrations/storage/storage.service';
import { AttachmentRepo } from '@docmost/db/repos/attachment/attachment.repo';
import { AttachmentType } from '../../attachment/attachment.constants';
import {
  getAttachmentFolderPath,
  compressAndResizeIcon,
} from '../../attachment/attachment.utils';
import { v7 as uuid7 } from 'uuid';
import { createHash } from 'crypto';

@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly authProviderRepo: AuthProviderRepo,
    private readonly userRepo: UserRepo,
    private readonly authAccountRepo: AuthAccountRepo,
    private readonly tokenService: TokenService,
    private readonly groupUserRepo: GroupUserRepo,
    private readonly workspaceService: WorkspaceService,
    private readonly storageService: StorageService,
    private readonly attachmentRepo: AttachmentRepo,
  ) { }

  private sanitizeUserInfo(userinfo: any, avatarAttribute?: string) {
    if (!userinfo.email || !isEmail(userinfo.email)) {
      throw new BadRequestException('Invalid email from OIDC provider');
    }

    if (
      !userinfo.sub ||
      typeof userinfo.sub !== 'string' ||
      userinfo.sub.length > 255
    ) {
      throw new BadRequestException('Invalid subject from OIDC provider');
    }

    let avatarUrl: string | undefined;
    let avatarBase64: string | undefined;

    if (avatarAttribute) {
      const avatarValue = userinfo[avatarAttribute];
      if (avatarValue && typeof avatarValue === 'string') {
        if (avatarValue.startsWith('data:image/')) {
          avatarBase64 = avatarValue;
        } else {
          try {
            const url = new URL(avatarValue);
            if (url.protocol === 'https:' || url.protocol === 'http:') {
              avatarUrl = avatarValue;
            }
          } catch {
            // Not a valid URL, ignore
          }
        }
      }
    }

    return {
      email: userinfo.email.toLowerCase().trim(),
      sub: userinfo.sub,
      name: userinfo.name
        ? String(userinfo.name).substring(0, 100)
        : userinfo.preferred_username || userinfo.email.split('@')[0],
      avatarUrl,
      avatarBase64,
    };
  }

  private async processBase64Avatar(
    base64Data: string,
    userId: string,
    workspaceId: string,
    currentAvatarUrl?: string,
  ): Promise<string | null> {
    const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      throw new BadRequestException('Invalid base64 image format');
    }

    const imageFormat = matches[1].toLowerCase();
    const base64Content = matches[2];

    const allowedFormats = ['png', 'jpeg', 'jpg', 'webp'];
    if (!allowedFormats.includes(imageFormat)) {
      throw new BadRequestException('Unsupported image format');
    }

    const buffer = Buffer.from(base64Content, 'base64');

    // Limit size at 5MB (make it configurable?).
    if (buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('Avatar image too large');
    }

    const processedBuffer = await compressAndResizeIcon(buffer, AttachmentType.Avatar);

    // Hash the processed image to detect duplicates.
    const contentHash = createHash('sha256').update(processedBuffer).digest('hex').substring(0, 16);

    // Check if current avatar is the same by comparing with stored file.
    if (currentAvatarUrl && !currentAvatarUrl.startsWith('http')) {
      try {
        const currentFilePath = `${getAttachmentFolderPath(AttachmentType.Avatar, workspaceId)}/${currentAvatarUrl}`;
        const currentFile = await this.storageService.read(currentFilePath);
        const currentBuffer = Buffer.isBuffer(currentFile) ? currentFile : Buffer.from(currentFile);
        const currentHash = createHash('sha256').update(currentBuffer).digest('hex').substring(0, 16);
        if (contentHash === currentHash) {
          return null; // Same image, no update needed.
        }
      } catch {
        // Current file not found or error reading, proceed with upload.
      }
    }

    const fileId = uuid7();
    const fileExtension = imageFormat === 'jpg' ? 'jpeg' : imageFormat;
    const fileName = `${fileId}.${fileExtension}`;
    const filePath = `${getAttachmentFolderPath(AttachmentType.Avatar, workspaceId)}/${fileName}`;

    await this.storageService.upload(filePath, processedBuffer);

    await this.attachmentRepo.insertAttachment({
      id: fileId,
      type: AttachmentType.Avatar,
      fileName,
      filePath,
      fileSize: processedBuffer.length,
      fileExt: `.${fileExtension}`,
      mimeType: `image/${fileExtension}`,
      creatorId: userId,
      workspaceId,
    });

    return fileName;
  }

  async getAuthorizationUrl(
    workspaceId: string,
    redirectUri: string,
  ): Promise<{ url: string; state: string }> {
    const authProvider =
      await this.authProviderRepo.findOidcProvider(workspaceId);

    if (!authProvider) {
      throw new BadRequestException('OIDC provider not found or not enabled');
    }

    const client = await this.createClient(authProvider);
    const state = generators.state();

    const url = client.authorizationUrl({
      scope: authProvider.scope,
      state,
      redirect_uri: redirectUri,
    });

    return { url, state };
  }

  async handleCallback(
    workspaceId: string,
    code: string,
    state: string,
    iss: string,
    redirectUri: string,
  ): Promise<{ token: string; user: User }> {
    const authProvider =
      await this.authProviderRepo.findOidcProvider(workspaceId);

    if (!authProvider) {
      throw new BadRequestException('OIDC provider not found or not enabled');
    }

    const client = await this.createClient(authProvider);

    try {
      const tokenSet = await client.callback(
        redirectUri,
        iss ? { code, state, iss } : { code, state },
        { state },
      );

      let userinfo;
      try {
        // Try to get claims from ID token first (faster).
        if (tokenSet.id_token) {
          const claims = tokenSet.claims();
          userinfo = claims;
        }

        // Fall back to userinfo endpoint if no ID token or missing required fields.
        if (!userinfo?.email) {
          userinfo = await client.userinfo(tokenSet.access_token);
        }
      } catch (userinfoError) {
        throw userinfoError;
      }

      if (authProvider.oidcAllowedGroups) {
        const allowedGroups = authProvider.oidcAllowedGroups
          .split(',')
          .map((g) => g.trim())
          .filter((g) => g.length > 0);

        if (allowedGroups.length > 0) {
          const userGroups = (userinfo.groups as string[]) || [];

          if (!Array.isArray(userGroups)) {
            throw new UnauthorizedException(
              'User has no groups or groups format is invalid from OIDC provider',
            );
          }

          const hasAllowedGroup = userGroups.some((group) =>
            allowedGroups.includes(group),
          );

          if (!hasAllowedGroup) {
            throw new UnauthorizedException(
              'User does not belong to any allowed group',
            );
          }
        }
      }

      const sanitizedUserinfo = this.sanitizeUserInfo(
        userinfo,
        authProvider.oidcAvatarAttribute,
      );

      if (!sanitizedUserinfo.email) {
        throw new BadRequestException('Email not provided by OIDC provider');
      }

      const workspace = await this.db
        .selectFrom('workspaces')
        .selectAll()
        .where('id', '=', workspaceId)
        .executeTakeFirst();

      if (!workspace) {
        throw new BadRequestException('Workspace not found');
      }

      validateAllowedEmail(sanitizedUserinfo.email as string, workspace);

      let user = await this.userRepo.findByEmail(
        sanitizedUserinfo.email as string,
        workspaceId,
      );

      if (user) {
        await this.linkAccountIfNeeded(
          user,
          sanitizedUserinfo.sub,
          authProvider.id,
        );
        let newAvatarUrl: string | undefined | null;
        if (sanitizedUserinfo.avatarBase64) {
          try {
            newAvatarUrl = await this.processBase64Avatar(
              sanitizedUserinfo.avatarBase64,
              user.id,
              workspaceId,
              user.avatarUrl,
            );
          } catch (err) {
            this.logger.warn(`Failed to process base64 avatar: ${err instanceof Error ? err.message : 'Unknown error'}`);
          }
        } else if (sanitizedUserinfo.avatarUrl && sanitizedUserinfo.avatarUrl !== user.avatarUrl) {
          newAvatarUrl = sanitizedUserinfo.avatarUrl;
        }

        if (newAvatarUrl) {
          await this.userRepo.updateUser(
            { avatarUrl: newAvatarUrl },
            user.id,
            workspaceId,
          );
          user.avatarUrl = newAvatarUrl;
        }
      } else {
        if (!authProvider.allowSignup) {
          throw new UnauthorizedException(
            'Account signup is not allowed for this OIDC provider',
          );
        }

        const existingAccount = await this.authAccountRepo.findByProviderUserId(
          sanitizedUserinfo.sub,
          authProvider.id,
          workspaceId,
        );

        if (existingAccount) {
          throw new BadRequestException(
            'Account already exists for this provider user ID',
          );
        }

        user = await this.createUserFromOidc(
          sanitizedUserinfo,
          authProvider,
          workspaceId,
        );
      }

      const token = await this.tokenService.generateAccessToken(user);

      return { token, user };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new UnauthorizedException(
        'OIDC authentication failed: ' + errorMessage,
      );
    }
  }

  private async createClient(authProvider: any): Promise<Client> {
    const issuer = await Issuer.discover(authProvider.oidcIssuer);

    return new issuer.Client({
      client_id: authProvider.oidcClientId,
      client_secret: authProvider.oidcClientSecret,
      response_types: ['code'],
    });
  }

  private async createUserFromOidc(
    userinfo: any,
    authProvider: any,
    workspaceId: string,
  ): Promise<User> {
    const userData: InsertableUser = {
      name: userinfo.name,
      email: userinfo.email,
      password: '', // Empty password new for OIDC users
      role: UserRole.MEMBER,
      emailVerifiedAt: new Date(),
      workspaceId,
      avatarUrl: userinfo.avatarUrl,
    };

    let user: User;

    await executeTx(this.db, async (trx) => {
      const existingUser = await this.userRepo.findByEmail(
        userinfo.email,
        workspaceId,
        { trx },
      );
      if (existingUser) {
        throw new BadRequestException('User with this email already exists');
      }

      user = await this.userRepo.insertUser(userData, trx);

      await this.authAccountRepo.create(
        {
          userId: user.id,
          providerUserId: userinfo.sub,
          authProviderId: authProvider.id,
          workspaceId,
        },
        trx,
      );

      // add user to workspace
      await this.workspaceService.addUserToWorkspace(
        user.id,
        workspaceId,
        undefined,
        trx,
      );

      // add user to default group
      await this.groupUserRepo.addUserToDefaultGroup(user.id, workspaceId, trx);
    });

    if (userinfo.avatarBase64) {
      try {
        const avatarFileName = await this.processBase64Avatar(
          userinfo.avatarBase64,
          user.id,
          workspaceId,
          undefined,
        );
        if (avatarFileName) {
          await this.userRepo.updateUser(
            { avatarUrl: avatarFileName },
            user.id,
            workspaceId,
          );
          user.avatarUrl = avatarFileName;
        }
      } catch (err) {
        this.logger.warn(`Failed to process base64 avatar for new user: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return user;
  }

  private async linkAccountIfNeeded(
    user: User,
    providerUserId: string,
    authProviderId: string,
  ): Promise<void> {
    const existingAccount = await this.authAccountRepo.findByUserAndProvider(
      user.id,
      authProviderId,
      user.workspaceId,
    );

    if (!existingAccount) {
      await this.authAccountRepo.create({
        userId: user.id,
        providerUserId,
        authProviderId,
        workspaceId: user.workspaceId,
      });
    }
  }
}
