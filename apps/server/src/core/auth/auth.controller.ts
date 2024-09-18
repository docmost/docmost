import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
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

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private environmentService: EnvironmentService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Req() req, @Body() loginInput: LoginDto) {
    return this.authService.login(loginInput, req.raw.workspaceId);
  }

  /* @HttpCode(HttpStatus.OK)
  @Post('register')
  async register(@Req() req, @Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto, req.raw.workspaceId);
  }
  */

  @UseGuards(SetupGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setupWorkspace(
    @Req() req,
    @Body() createAdminUserDto: CreateAdminUserDto,
  ) {
    if (this.environmentService.isCloud()) throw new NotFoundException();
    return this.authService.setup(createAdminUserDto);
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
    return this.authService.forgotPassword(forgotPasswordDto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset')
  async passwordReset(
    @Body() passwordResetDto: PasswordResetDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.passwordReset(passwordResetDto, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify-token')
  async verifyResetToken(
    @Body() verifyUserTokenDto: VerifyUserTokenDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.authService.verifyUserToken(verifyUserTokenDto, workspace.id);
  }
}
