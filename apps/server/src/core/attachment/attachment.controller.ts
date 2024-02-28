import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AttachmentService } from './attachment.service';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AttachmentInterceptor } from './attachment.interceptor';
import { JwtGuard } from '../auth/guards/jwt.guard';
import * as bytes from 'bytes';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { CurrentWorkspace } from '../../decorators/current-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('upload/avatar')
  @UseInterceptors(AttachmentInterceptor)
  async uploadAvatar(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthUser() user: User,
  ) {
    const maxFileSize = bytes('5MB');

    try {
      const file = req.file({
        limits: { fileSize: maxFileSize, fields: 1, files: 1 },
      });

      const fileResponse = await this.attachmentService.uploadAvatar(
        file,
        user.id,
      );

      return res.send(fileResponse);
    } catch (err) {
      throw new BadRequestException('Error processing file upload.');
    }
  }

  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('upload/workspace-logo')
  @UseInterceptors(AttachmentInterceptor)
  async uploadWorkspaceLogo(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    const maxFileSize = bytes('5MB');

    try {
      const file = req.file({
        limits: { fileSize: maxFileSize, fields: 1, files: 1 },
      });

      const fileResponse = await this.attachmentService.uploadWorkspaceLogo(
        file,
        workspace.id,
        user.id,
      );

      return res.send(fileResponse);
    } catch (err) {
      throw new BadRequestException('Error processing file upload.');
    }
  }

  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('upload/file')
  @UseInterceptors(AttachmentInterceptor)
  async uploadFile(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthUser() user: User,
    @CurrentWorkspace() workspace: Workspace,
  ) {
    const maxFileSize = bytes('20MB');

    try {
      const file = req.file({
        limits: { fileSize: maxFileSize, fields: 1, files: 1 },
      });

      const fileResponse = await this.attachmentService.uploadWorkspaceLogo(
        file,
        workspace.id,
        user.id,
      );

      return res.send(fileResponse);
    } catch (err) {
      throw new BadRequestException('Error processing file upload.');
    }
  }
}
