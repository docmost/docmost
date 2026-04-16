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
import { FastifyReply, FastifyRequest } from 'fastify';

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('status')
  async status(@AuthUser() user: User, @AuthWorkspace() workspace: Workspace) {
    return this.mfaService.getMfaStatus(user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('setup')
  async setup(@Req() req: FastifyRequest) {
    const { user } = await this.mfaService.getUserForSetup(req);
    return this.mfaService.setupMfa(user);
  }

  @HttpCode(HttpStatus.OK)
  @Post('enable')
  async enable(
    @Req() req: FastifyRequest,
    @Body() body: { secret: string; verificationCode: string },
  ) {
    const { user, workspace } = await this.mfaService.getUserForSetup(req);
    return this.mfaService.enableMfa(user, workspace.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('disable')
  async disable(
    @Body() body: { confirmPassword?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.mfaService.disableMfa(user, workspace.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('generate-backup-codes')
  async generateBackupCodes(
    @Body() body: { confirmPassword?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.mfaService.regenerateBackupCodes(user, workspace.id, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post('verify')
  async verify(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
    @Body() body: { code: string },
  ) {
    return this.mfaService.verifyMfaCode(req, res, body.code);
  }

  @HttpCode(HttpStatus.OK)
  @Post('validate-access')
  async validateAccess(@Req() req: FastifyRequest) {
    return this.mfaService.validateAccess(req);
  }
}

