import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NextcloudService } from './nextcloud.service';

@Controller('nextcloud')
@UseGuards(JwtAuthGuard)
export class NextcloudController {
  constructor(private readonly nextcloudService: NextcloudService) {}

  /**
   * List files/folders at a given WebDAV path
   * GET /nextcloud/list?path=/Photos
   */
  @Get('list')
  @HttpCode(HttpStatus.OK)
  async listFiles(
    @Query('path') path: string = '/',
    @Query('ncUrl') ncUrl: string,
    @Query('ncUser') ncUser: string,
    @Query('ncPassword') ncPassword: string,
  ) {
    if (!ncUrl || !ncUser || !ncPassword) {
      throw new UnauthorizedException('Missing Nextcloud credentials');
    }
    return this.nextcloudService.listFiles(ncUrl, ncUser, ncPassword, path);
  }

  /**
   * Create a public share link for a file
   * POST /nextcloud/share
   */
  @Post('share')
  @HttpCode(HttpStatus.OK)
  async createShare(
    @Body()
    body: {
      ncUrl: string;
      ncUser: string;
      ncPassword: string;
      filePath: string;
    },
  ) {
    const { ncUrl, ncUser, ncPassword, filePath } = body;
    if (!ncUrl || !ncUser || !ncPassword || !filePath) {
      throw new UnauthorizedException('Missing Nextcloud credentials or path');
    }
    return this.nextcloudService.createShare(ncUrl, ncUser, ncPassword, filePath);
  }
}
