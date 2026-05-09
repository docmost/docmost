import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';
import { TransclusionService } from './transclusion.service';
import { LookupDto } from './dto/lookup.dto';
import { ReferencesDto } from './dto/references.dto';
import { UnsyncReferenceDto } from './dto/unsync-reference.dto';

@UseGuards(JwtAuthGuard)
@Controller('pages/transclusion')
export class TransclusionController {
  constructor(private readonly transclusionService: TransclusionService) {}

  @HttpCode(HttpStatus.OK)
  @Post('lookup')
  async lookup(@Body() dto: LookupDto, @AuthUser() user: User) {
    return this.transclusionService.lookup(
      dto.references,
      user.id,
      user.workspaceId,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('references')
  async references(
    @Body() dto: ReferencesDto,
    @AuthUser() user: User,
  ) {
    return this.transclusionService.listReferences({
      sourcePageId: dto.sourcePageId,
      transclusionId: dto.transclusionId,
      viewerUserId: user.id,
      workspaceId: user.workspaceId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('unsync-reference')
  async unsyncReference(
    @Body() dto: UnsyncReferenceDto,
    @AuthUser() user: User,
  ) {
    return this.transclusionService.unsyncReference(
      dto.referencePageId,
      dto.sourcePageId,
      dto.transclusionId,
      user,
    );
  }
}
