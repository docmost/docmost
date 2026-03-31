import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
  SetMetadata,
} from '@nestjs/common';
import { SearchService } from '../../core/search/search.service';
import { SearchDTO } from '../../core/search/dto/search.dto';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AttachmentEeService } from './attachment-ee.service';
import { Public } from '../../common/decorators/public.decorator';

@UseGuards(JwtAuthGuard)
@Controller('search-attachments')
export class AttachmentSearchController {
  private readonly logger = new Logger(AttachmentSearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly attachmentEeService: AttachmentEeService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async searchAttachments(
    @Body() searchDto: SearchDTO,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.logger.log(`Searching attachments: query="${searchDto.query}", userId=${user.id}, workspaceId=${workspace.id}`);

    if (searchDto.spaceId) {
      const ability = await this.spaceAbility.createForUser(
        user,
        searchDto.spaceId,
      );

      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    }

    const results = await this.searchService.searchAttachments(searchDto, {
      userId: user.id,
      workspaceId: workspace.id,
    });

    this.logger.log(`Search results: ${results.length} attachments found`);
    return results;
  }

  @HttpCode(HttpStatus.OK)
  @Post('reindex')
  async reindexAttachments(@AuthWorkspace() workspace: Workspace) {
    await this.attachmentEeService.indexAttachments(workspace.id);
    return { success: true, message: 'Attachment indexing completed' };
  }

  @HttpCode(HttpStatus.OK)
  @Post('reindex-all')
  async reindexAllAttachments(@AuthWorkspace() workspace: Workspace) {
    this.logger.log(`Starting full re-index of all PDF/DOCX attachments for workspace ${workspace.id}`);
    const result = await this.attachmentEeService.reindexAllAttachments(workspace.id);
    return {
      success: true,
      message: `Re-indexed ${result.success} of ${result.total} attachments`,
      ...result,
    };
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('test')
  async testSearch(@Body() body: { query: string }) {
    // Test endpoint without full auth - just for debugging
    this.logger.log(`TEST endpoint called with query: ${body.query}`);

    // Direct database query for testing
    const results = await this.searchService.searchAttachments(
      { query: body.query },
      {
        userId: '019b14b6-fcdb-75be-b571-c4d18aa83f0e',
        workspaceId: '019b14b6-fce0-7a6f-a1ed-98754e394776'
      }
    );

    return { count: results.length, results };
  }
}
