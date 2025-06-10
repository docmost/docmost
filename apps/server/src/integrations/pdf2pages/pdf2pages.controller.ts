import {
  Controller,
  Req,
  Post,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {FastifyRequest } from 'fastify';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { Pdf2PagesService } from './pdf2pages.service';
import { extractDocNodeFromPDF } from './pdfBufferToJson';
import { User, Workspace } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';

@Controller('pdf2pages')
export class Pdf2PagesController {
  constructor(
    private pdf2pagesService: Pdf2PagesService,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}
  @UseGuards(JwtAuthGuard)
  @Post('convert')
  async uploadFile(
    @Req() req: FastifyRequest,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ): Promise<any> {
    const parts = req.parts();
    const formData: Record<string, any> = {};
    let json = {};
    for await (const part of parts) {
      if (part.type === 'file') {
        const stream = part.file; // This is a Readable stream
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        json = await extractDocNodeFromPDF(buffer);

      } else {
        // It's a regular field
        formData[part.fieldname] = part.value;
      }
    }
    const ability = await this.spaceAbility.createForUser(
      user,
      formData.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
    return this.pdf2pagesService.convertPdf2Pages(formData.spaceId, user.id, workspace.id, json);
  }
}
