import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import { SsoAuthService } from './sso-auth.service';
import { FastifyReply } from 'fastify';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Workspace } from '@docmost/db/types/entity.types';

@Controller('sso')
export class SsoAuthController {
  constructor(private readonly ssoAuthService: SsoAuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('ldap/:providerId/login')
  async ldapLogin(
    @Param('providerId') providerId: string,
    @Body() body: { username: string; password: string },
    @AuthWorkspace() workspace: Workspace,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const authToken = await this.ssoAuthService.ldapLogin(
      providerId,
      body,
      workspace.id,
    );
    res.setCookie('authToken', authToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
    });
    return {};
  }
}
