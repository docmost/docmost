import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchDTO, SearchSuggestionDTO } from './dto/search.dto';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async pageSearch(
    @Body() searchDto: SearchDTO,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.searchService.searchPage(
      searchDto.query,
      searchDto,
      workspace.id,
    );
  }

  @Post('suggest')
  async searchSuggestions(
    @Body() dto: SearchSuggestionDTO,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.searchService.searchSuggestions(dto, workspace.id);
  }
}
