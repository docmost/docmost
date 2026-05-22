import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { RevokeSessionDto } from './dto/revoke-session.dto';
import { FastifyRequest } from 'fastify';

@UseGuards(JwtAuthGuard)
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async listSessions(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
  ) {
    const currentSessionId = (req.raw as any).sessionId ?? null;
    const sessions = await this.sessionService.getActiveSessions(
      user.id,
      workspace.id,
      currentSessionId,
    );
    return { sessions };
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revokeSession(
    @Body() dto: RevokeSessionDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
  ) {
    const currentSessionId = (req.raw as any).sessionId;
    if (dto.sessionId === currentSessionId) {
      throw new BadRequestException(
        'Cannot revoke current session. Use logout instead.',
      );
    }
    await this.sessionService.revokeSession(
      dto.sessionId,
      user.id,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke-all')
  async revokeAllSessions(
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Req() req: FastifyRequest,
  ) {
    const currentSessionId = (req.raw as any).sessionId;
    if (!currentSessionId) {
      throw new BadRequestException(
        'Current session not found. Please log in again.',
      );
    }
    await this.sessionService.revokeAllOtherSessions(
      currentSessionId,
      user.id,
      workspace.id,
    );
  }
}
