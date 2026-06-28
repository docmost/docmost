import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { MfaService } from './services/mfa.service';
import { RequireFeature } from '../common/decorators/require-feature.decorator';
import { Feature } from '../../common/features';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Public } from '../../common/decorators/public.decorator';

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('status')
  @RequireFeature(Feature.MFA)
  async status(@AuthUser() user: User) {
    return this.mfaService.getStatus(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('setup')
  @RequireFeature(Feature.MFA)
  async setup(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.mfaService.setup(user, workspace);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('enable')
  @RequireFeature(Feature.MFA)
  async enable(
    @AuthUser() user: User,
    @Body() body: { verificationCode: string },
  ) {
    return this.mfaService.enable(user.id, body.verificationCode);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('disable')
  @RequireFeature(Feature.MFA)
  async disable(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: { confirmPassword?: string },
  ) {
    return this.mfaService.disable(user.id, workspace.id, body.confirmPassword);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('generate-backup-codes')
  @RequireFeature(Feature.MFA)
  async generateBackupCodes(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Body() body: { confirmPassword?: string },
  ) {
    return this.mfaService.regenerateBackupCodes(
      user.id,
      workspace.id,
      body.confirmPassword,
    );
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('validate-access')
  async validateAccess(@Req() req: FastifyRequest) {
    return this.mfaService.validateMfaAccess(req);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('verify')
  async verify(
    @Body() body: { code: string },
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    return this.mfaService.verifyAndLogin(body.code, req, res);
  }
}
