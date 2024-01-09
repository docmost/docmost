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
import { JwtUser } from '../../decorators/jwt-user.decorator';
import { JwtGuard } from '../auth/guards/JwtGuard';
import * as bytes from 'bytes';

@Controller('attachments')
export class AttachmentController {
  constructor(private readonly attachmentService: AttachmentService) {}

  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('upload/avatar')
  @UseInterceptors(AttachmentInterceptor)
  async uploadAvatar(
    @JwtUser() jwtUser,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const maxFileSize = bytes('5MB');

    try {
      const file = req.file({
        limits: { fileSize: maxFileSize, fields: 1, files: 1 },
      });

      const fileResponse = await this.attachmentService.uploadAvatar(
        file,
        jwtUser.id,
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
    @JwtUser() jwtUser,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const maxFileSize = bytes('5MB');

    try {
      const file = req.file({
        limits: { fileSize: maxFileSize, fields: 1, files: 1 },
      });

      // TODO FIX
      const workspaceId = '123';

      const fileResponse = await this.attachmentService.uploadWorkspaceLogo(
        file,
        workspaceId,
        jwtUser.id,
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
    @JwtUser() jwtUser,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    const maxFileSize = bytes('20MB');

    try {
      const file = req.file({
        limits: { fileSize: maxFileSize, fields: 1, files: 1 },
      });

      const workspaceId = '123';

      const fileResponse = await this.attachmentService.uploadWorkspaceLogo(
        file,
        workspaceId,
        jwtUser.id,
      );

      return res.send(fileResponse);
    } catch (err) {
      throw new BadRequestException('Error processing file upload.');
    }
  }
}
