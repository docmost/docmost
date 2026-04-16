import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TokenService } from '../../core/auth/services/token.service';
import { JwtType } from '../../core/auth/dto/jwt-payload';
import { PageRepo } from '@docmost/db/repos/page/page.repo';

@Controller('pdf-export')
export class PdfExportController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly pageRepo: PageRepo,
  ) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('render')
  async render(
    @Body() body: { pageId: string; token: string },
  ) {
    if (!body?.pageId || !body?.token) {
      throw new BadRequestException('pageId and token are required');
    }

    const payload = await this.tokenService.verifyJwt(body.token, JwtType.PDF_RENDER);
    if (payload.pageId !== body.pageId) {
      throw new BadRequestException('Invalid PDF render token');
    }

    const page = await this.pageRepo.findById(body.pageId, {
      includeContent: true,
    });
    if (!page || page.workspaceId !== payload.workspaceId) {
      throw new BadRequestException('Page not found');
    }

    return {
      pageId: page.id,
      title: page.title,
      content: page.content,
    };
  }
}
