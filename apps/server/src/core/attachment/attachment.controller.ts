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
import * as bytes from 'bytes';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('upload/workspace-logo')
  @UseInterceptors(AttachmentInterceptor)
  async uploadWorkspaceLogo(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
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

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('upload/file')
  @UseInterceptors(AttachmentInterceptor)
  async uploadFile(
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
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
