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
import { SearchDTO } from './dto/search.dto';
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
    @Query('type') type: string,
    @Body() searchDto: SearchDTO,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (!type || type === 'page') {
      return this.searchService.searchPage(
        searchDto.query,
        searchDto,
        workspace.id,
      );
    }
    return;
  }
}
