import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './services/auth.service';
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
import { validateSsoEnforcement } from './auth.util';
import { FastifyReply, FastifyRequest } from 'fastify';
import { addDays, addMinutes } from 'date-fns';
import {type RegistrationResponseJSON, type AuthenticationResponseJSON} from '@simplewebauthn/server';
import { PasskeyLoginDto } from './dto/passkey-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() loginInput: LoginDto,
  ) {
    validateSsoEnforcement(workspace);

    const authToken = await this.authService.login(loginInput, workspace.id);
    this.setAuthCookie(res, authToken);
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

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.changePassword(dto, user.id, workspace.id);
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
    const authToken = await this.authService.passwordReset(
      passwordResetDto,
      workspace.id,
    );
    this.setAuthCookie(res, authToken);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-token')
  async verifyResetToken(
    @Body() verifyUserTokenDto: VerifyUserTokenDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.verifyUserToken(verifyUserTokenDto, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('collab-token')
  async collabToken(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.getCollabToken(user.id, workspace.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.clearCookie('authToken');
  }

  @HttpCode(HttpStatus.OK)
  @Post('initiate-passkey-authentication')
  async initiatePassKeyLogin(
    @Req() req,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() loginInput: PasskeyLoginDto,
  ) {
    const options = await this.authService.initiatePasskeyAuthentication(
      loginInput,
      req.raw.workspaceId,
    );

    res.setCookie('webauthnChallenge', options.challenge, {
      httpOnly: true,
      path: '/',
      expires: addMinutes(new Date(), 5),
      secure: this.environmentService.isHttps(),
    });

    res.setCookie('webauthnEmail', loginInput.email, {
      httpOnly: true,
      path: '/',
      expires: addMinutes(new Date(), 5),
      secure: this.environmentService.isHttps(),
    });

    return options;
  }

  @HttpCode(HttpStatus.OK)
  @Post('passkey-authentication')
  async authenticateWithPasskey(
    @Req() req,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() loginInput: AuthenticationResponseJSON,
  ) {
    const challenge = req.cookies['webauthnChallenge'];
    const email = req.cookies['webauthnEmail'];
    const token = await this.authService.authenticateWithPasskey(
      loginInput,
      email,
      req.raw.workspaceId,
      challenge,
    );

    //removing cookies
    res.setCookie('webauthnChallenge', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
      secure: this.environmentService.isHttps(),
    });

    res.setCookie('webauthnEmail', '', {
      httpOnly: true,
      path: '/',
      maxAge: 0,
      secure: this.environmentService.isHttps(),
    });

    this.setAuthCookie(res, token);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('register-challenge')
  async initiatePassKeyRegistration(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const options = await this.authService.registerChallenge(user, workspace);

    res.setCookie('webauthnChallenge', options.challenge, {
      httpOnly: true,
      path: '/',
      expires: addMinutes(new Date(), 5),
      secure: this.environmentService.isHttps(),
    });
    return options;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('verify-challenge')
  async verifyPasskeyChallenge(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
    @Body() dto: RegistrationResponseJSON,
  ) {
    const challenge = req.cookies['webauthnChallenge'];

    return this.authService.verifyPasskeyChallenge(challenge, dto, user, workspace);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('remove-passkey')
  async removePasskey(@AuthUser() user: User) {
    return this.authService.removePasskey(user);
  }

  setAuthCookie(res: FastifyReply, token: string) {
    res.setCookie('authToken', token, {
      httpOnly: true,
      path: '/',
      expires: addDays(new Date(), 30),
      secure: this.environmentService.isHttps(),
    });
  }
}
