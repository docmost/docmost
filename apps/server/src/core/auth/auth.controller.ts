import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AI_CHAT_THROTTLER,
  AUTH_THROTTLER,
} from '../../integrations/throttle/throttler-names';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
import { OauthService } from './services/oauth.service';
import { SessionService } from '../session/session.service';
import { SetupGuard } from './guards/setup.guard';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { PasswordResetDto } from './dto/password-reset.dto';
import { VerifyUserTokenDto } from './dto/verify-user-token.dto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { validateSsoEnforcement } from './auth.util';
import { ModuleRef } from '@nestjs/core';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';

@SkipThrottle({ [AI_CHAT_THROTTLER]: true })
@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly oauthStateCookieName = 'oauthState';
  private readonly oauthNonceCookieName = 'oauthNonce';
  private readonly oauthPkceCookieName = 'oauthPkceCodeVerifier';
  private readonly oauthRedirectCookieName = 'oauthRedirect';

  constructor(
    private authService: AuthService,
    private oauthService: OauthService,
    private sessionService: SessionService,
    private environmentService: EnvironmentService,
    private moduleRef: ModuleRef,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() loginInput: LoginDto,
  ) {
    validateSsoEnforcement(workspace);

    let MfaModule: any;
    let isMfaModuleReady = false;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      MfaModule = require('./../../ee/mfa/services/mfa.service');
      isMfaModuleReady = true;
    } catch (err) {
      this.logger.debug(
        'MFA module requested but EE module not bundled in this build',
      );
      isMfaModuleReady = false;
    }
    if (isMfaModuleReady) {
      const mfaService = this.moduleRef.get(MfaModule.MfaService, {
        strict: false,
      });

      const mfaResult = await mfaService.checkMfaRequirements(
        loginInput,
        workspace,
        res,
      );

      if (mfaResult) {
        // If user has MFA enabled OR workspace enforces MFA, require MFA verification
        if (mfaResult.userHasMfa || mfaResult.requiresMfaSetup) {
          return {
            userHasMfa: mfaResult.userHasMfa,
            requiresMfaSetup: mfaResult.requiresMfaSetup,
            isMfaEnforced: mfaResult.isMfaEnforced,
          };
        } else if (mfaResult.authToken) {
          // User doesn't have MFA and workspace doesn't require it
          this.setAuthCookie(res, mfaResult.authToken);
          return;
        }
      }
    }

    const authToken = await this.authService.login(loginInput, workspace.id);
    this.setAuthCookie(res, authToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('forward-auth/login')
  async forwardAuthLogin(
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const authToken = await this.getForwardAuthToken(req, workspace);
    this.setAuthCookie(res, authToken);
  }

  @Get('forward-auth/login')
  async forwardAuthLoginRedirect(
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @Query('redirect') redirect?: string,
  ) {
    const authToken = await this.getForwardAuthToken(req, workspace);
    this.setAuthCookie(res, authToken);
    return res
      .code(HttpStatus.FOUND)
      .redirect(this.getSafeRedirectPath(redirect));
  }

  @Get('oauth/login')
  async oauthLoginRedirect(
    @Res() res: FastifyReply,
    @Query('redirect') redirect?: string,
  ) {
    if (!this.environmentService.isOAuthEnabled()) {
      throw new UnauthorizedException();
    }

    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const codeVerifier = this.oauthService.generatePkceCodeVerifier();

    this.setTemporaryCookie(res, this.oauthStateCookieName, state);
    this.setTemporaryCookie(res, this.oauthNonceCookieName, nonce);
    this.setTemporaryCookie(res, this.oauthPkceCookieName, codeVerifier);
    this.setTemporaryCookie(
      res,
      this.oauthRedirectCookieName,
      this.getSafeRedirectPath(redirect),
    );

    const authorizationUrl = await this.oauthService.buildLoginUrl(
      state,
      nonce,
      codeVerifier,
    );
    return res.code(HttpStatus.FOUND).redirect(authorizationUrl.toString());
  }

  @Get('oauth/callback')
  async oauthCallback(
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    if (!this.environmentService.isOAuthEnabled()) {
      throw new UnauthorizedException();
    }

    const state = req.cookies?.[this.oauthStateCookieName];
    const nonce = req.cookies?.[this.oauthNonceCookieName];
    const codeVerifier = req.cookies?.[this.oauthPkceCookieName];
    const redirect = req.cookies?.[this.oauthRedirectCookieName];

    if (!state || !nonce || !codeVerifier) {
      throw new UnauthorizedException(
        'OAuth login session is missing or expired',
      );
    }

    if (req.query?.['error']) {
      throw new UnauthorizedException(
        'OAuth provider denied the login request',
      );
    }

    const profile = await this.oauthService.getProfileFromCallback(
      req,
      state,
      nonce,
      codeVerifier,
    );

    this.clearTemporaryCookie(res, this.oauthStateCookieName);
    this.clearTemporaryCookie(res, this.oauthNonceCookieName);
    this.clearTemporaryCookie(res, this.oauthPkceCookieName);
    this.clearTemporaryCookie(res, this.oauthRedirectCookieName);

    const authToken = await this.authService.oauthLogin({
      email: profile.email,
      name: profile.name,
      workspaceId: workspace.id,
    });

    this.setAuthCookie(res, authToken);
    return res
      .code(HttpStatus.FOUND)
      .redirect(this.getSafeRedirectPath(redirect));
  }

  @UseGuards(SetupGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setupWorkspace(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() createAdminUserDto: CreateAdminUserDto,
  ) {
    const { workspace, authToken } =
      await this.authService.setup(createAdminUserDto);

    this.setAuthCookie(res, authToken);
    return workspace;
  }

  @SkipThrottle({ [AUTH_THROTTLER]: true })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
  ) {
    const currentSessionId = (req.raw as any).sessionId;
    return this.authService.changePassword(
      dto,
      user.id,
      workspace.id,
      currentSessionId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    validateSsoEnforcement(workspace);
    return this.authService.forgotPassword(forgotPasswordDto, workspace);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset')
  async passwordReset(
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() passwordResetDto: PasswordResetDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const result = await this.authService.passwordReset(
      passwordResetDto,
      workspace,
    );

    if (result.requiresLogin) {
      return {
        requiresLogin: true,
      };
    }

    // Set auth cookie if no MFA is required
    this.setAuthCookie(res, result.authToken);
    return {
      requiresLogin: false,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-token')
  async verifyResetToken(
    @Body() verifyUserTokenDto: VerifyUserTokenDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.verifyUserToken(verifyUserTokenDto, workspace.id);
  }

  @SkipThrottle({ [AUTH_THROTTLER]: true })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('collab-token')
  async collabToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.getCollabToken(user, workspace.id);
  }

  @SkipThrottle({ [AUTH_THROTTLER]: true })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @AuthUser() user: User,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const sessionId = (req.raw as any).sessionId;
    if (sessionId) {
      await this.sessionService.revokeSession(
        sessionId,
        user.id,
        user.workspaceId,
      );
    }

    res.clearCookie('authToken');

    this.auditService.log({
      event: AuditEvent.USER_LOGOUT,
      resourceType: AuditResource.USER,
      resourceId: user.id,
    });
  }

  setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: this.environmentService.getCookieExpiresIn(),
      secure: this.environmentService.isHttps(),
    });
  }

  private setTemporaryCookie(res: FastifyReply, name: string, value: string) {
    res.setCookie(name, value, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      expires: new Date(Date.now() + 10 * 60 * 1000),
      secure: this.environmentService.isHttps(),
    });
  }

  private clearTemporaryCookie(res: FastifyReply, name: string) {
    res.clearCookie(name, { path: '/' });
  }

  private async getForwardAuthToken(
    req: FastifyRequest,
    workspace: Workspace,
  ): Promise<string> {
    this.validateForwardAuthSecret(req);

    const email = this.getHeaderValue(
      req,
      this.environmentService.getForwardAuthEmailHeader(),
    );
    const name =
      this.getHeaderValue(
        req,
        this.environmentService.getForwardAuthNameHeader(),
      ) ||
      this.getHeaderValue(
        req,
        this.environmentService.getForwardAuthUserHeader(),
      );

    return this.authService.forwardAuthLogin({
      email,
      name,
      workspaceId: workspace.id,
    });
  }

  private validateForwardAuthSecret(req: FastifyRequest) {
    const expectedSecret = this.environmentService.getForwardAuthSecret();
    if (!expectedSecret) {
      return;
    }

    const actualSecret = this.getHeaderValue(
      req,
      this.environmentService.getForwardAuthSecretHeader(),
    );

    if (actualSecret !== expectedSecret) {
      throw new UnauthorizedException();
    }
  }

  private getHeaderValue(req: FastifyRequest, headerName: string) {
    const value = req.headers[headerName.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private getSafeRedirectPath(redirect?: string): string {
    if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
      return '/home';
    }

    return redirect;
  }
}
