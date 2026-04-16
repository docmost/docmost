import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotImplementedException,
  Param,
  Post,
  Query,
  Redirect,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import WorkspaceAbilityFactory from '../../core/casl/abilities/workspace-ability.factory';
import {
  WorkspaceCaslAction,
  WorkspaceCaslSubject,
} from '../../core/casl/interfaces/workspace-ability.type';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { OidcAuthService } from './oidc-auth.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EnvironmentService } from '../../integrations/environment/environment.service';

const OIDC_STATE_COOKIE = 'oidcAuthState';
const OIDC_STATE_TTL_MS = 10 * 60 * 1000;

@Controller('sso')
export class SecurityController {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly workspaceAbility: WorkspaceAbilityFactory,
    private readonly oidcAuthService: OidcAuthService,
    private readonly environmentService: EnvironmentService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(
    @Body() body: { providerId?: string; id?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    const providerId = body?.providerId ?? body?.id;
    if (!providerId) {
      throw new BadRequestException('providerId is required');
    }
    return this.findProvider(workspace.id, providerId);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('providers')
  async providers(
    @Body()
    body: { cursor?: string; beforeCursor?: string; limit?: number },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);

    const result = await executeWithCursorPagination(
      this.db
        .selectFrom('authProviders')
        .selectAll()
        .where('workspaceId', '=', workspace.id)
        .where('deletedAt', 'is', null),
      {
        perPage: body?.limit ?? 50,
        cursor: body?.cursor,
        beforeCursor: body?.beforeCursor,
        fields: [
          {
            expression: 'authProviders.createdAt',
            direction: 'desc',
            key: 'createdAt',
          },
          { expression: 'authProviders.id', direction: 'desc', key: 'id' },
        ],
        parseCursor: (cursor) => ({
          createdAt: new Date(cursor.createdAt),
          id: cursor.id,
        }),
      },
    );

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() body: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);

    const inserted = await this.db
      .insertInto('authProviders')
      .values({
        name: body?.name ?? 'SSO',
        type: body?.type,
        creatorId: user.id,
        workspaceId: workspace.id,
      })
      .returningAll()
      .executeTakeFirst();

    this.auditService.log({
      event: AuditEvent.SSO_PROVIDER_CREATED,
      resourceType: AuditResource.SSO_PROVIDER,
      resourceId: inserted.id,
    });

    return inserted;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() body: any,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);
    const providerId = body?.id ?? body?.providerId;
    if (!providerId) {
      throw new BadRequestException('id is required');
    }

    const {
      id: _id,
      providerId: _providerId,
      creatorId: _creatorId,
      workspaceId: _workspaceId,
      createdAt: _createdAt,
      deletedAt: _deletedAt,
      ...updates
    } = body ?? {};

    const updated = await this.db
      .updateTable('authProviders')
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspace.id)
      .where('deletedAt', 'is', null)
      .returningAll()
      .executeTakeFirst();

    this.auditService.log({
      event: AuditEvent.SSO_PROVIDER_UPDATED,
      resourceType: AuditResource.SSO_PROVIDER,
      resourceId: providerId,
    });

    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async remove(
    @Body() body: { providerId: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertCanManage(user, workspace);

    await this.db
      .updateTable('authProviders')
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where('id', '=', body.providerId)
      .where('workspaceId', '=', workspace.id)
      .execute();

    this.auditService.log({
      event: AuditEvent.SSO_PROVIDER_DELETED,
      resourceType: AuditResource.SSO_PROVIDER,
      resourceId: body.providerId,
    });
  }

  @Public()
  @SkipTransform()
  @Get(':type/:providerId/login')
  async loginRedirect(
    @Param('type') type: string,
    @Param('providerId') providerId: string,
    @AuthWorkspace() workspace: Workspace,
    @Query('redirect') redirectTo: string | undefined,
    @Res() res: FastifyReply,
  ) {
    if (type === 'oidc') {
      try {
        const { authorizationUrl, stateCookie } =
          await this.oidcAuthService.beginLogin(
            workspace,
            providerId,
            redirectTo,
          );

        this.setOidcStateCookie(res, stateCookie);
        return res.code(HttpStatus.FOUND).redirect(authorizationUrl);
      } catch (error) {
        this.clearOidcStateCookie(res);
        return res.code(HttpStatus.FOUND).redirect(
          this.oidcAuthService.buildLoginErrorUrl(
            workspace,
            this.getErrorMessage(error),
          ),
        );
      }
    }

    throw new NotImplementedException(
      `${type.toUpperCase()} SSO login is not implemented in the local EE shim for provider ${providerId}`,
    );
  }

  @Public()
  @SkipTransform()
  @Get('oidc/:providerId/callback')
  async oidcCallback(
    @Param('providerId') providerId: string,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const stateCookie = req.cookies?.[OIDC_STATE_COOKIE];

    try {
      const currentUrl = new URL(
        req.raw.url,
        this.oidcAuthService.getCallbackUrl(workspace, providerId),
      );

      const result = await this.oidcAuthService.finishLogin(
        workspace,
        providerId,
        currentUrl,
        stateCookie,
      );

      this.clearOidcStateCookie(res);
      this.setAuthCookie(res, result.authToken, result.authTokenTtlMs);
      return res.code(HttpStatus.FOUND).redirect(result.redirectUrl);
    } catch (error) {
      this.clearOidcStateCookie(res);
      return res.code(HttpStatus.FOUND).redirect(
        this.oidcAuthService.buildLoginErrorUrl(
          workspace,
          this.getErrorMessage(error),
          stateCookie,
        ),
      );
    }
  }

  @Public()
  @SkipTransform()
  @Get('google/login')
  async googleLogin(@Query('workspaceId') workspaceId?: string) {
    throw new NotImplementedException(
      `Google SSO login is not implemented in the local EE shim${workspaceId ? ` for workspace ${workspaceId}` : ''}`,
    );
  }

  @Public()
  @SkipTransform()
  @Get('google/signup')
  @Redirect()
  async googleSignup() {
    throw new NotImplementedException(
      'Google SSO signup is not implemented in the local EE shim',
    );
  }

  @Public()
  @Post('ldap/:providerId/login')
  async ldapLogin(@Param('providerId') providerId: string) {
    throw new NotImplementedException(
      `LDAP SSO login is not implemented in the local EE shim for provider ${providerId}`,
    );
  }

  private async findProvider(workspaceId: string, providerId: string) {
    const provider = await this.db
      .selectFrom('authProviders')
      .selectAll()
      .where('id', '=', providerId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    if (!provider) {
      throw new BadRequestException('SSO provider not found');
    }

    return provider;
  }

  private assertCanManage(user: User, workspace: Workspace): void {
    const ability = this.workspaceAbility.createForUser(user, workspace);
    if (
      ability.cannot(WorkspaceCaslAction.Manage, WorkspaceCaslSubject.Settings)
    ) {
      throw new ForbiddenException();
    }
  }

  private setAuthCookie(
    res: FastifyReply,
    token: string,
    ttlMs?: number,
  ): void {
    res.setCookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: ttlMs
        ? new Date(Date.now() + ttlMs)
        : this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }

  private setOidcStateCookie(res: FastifyReply, stateCookie: string): void {
    res.setCookie(OIDC_STATE_COOKIE, stateCookie, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(Date.now() + OIDC_STATE_TTL_MS),
      secure: this.environmentService.isHttps(),
    });
  }

  private clearOidcStateCookie(res: FastifyReply): void {
    res.clearCookie(OIDC_STATE_COOKIE, {
      path: '/',
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }

      if (typeof response === 'object' && response) {
        const message = (response as Record<string, any>).message;
        if (Array.isArray(message)) {
          return message[0];
        }
        if (typeof message === 'string') {
          return message;
        }
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'SSO login failed';
  }
}
