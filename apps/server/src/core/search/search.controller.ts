import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard';
import { SearchService } from './search.service';
import { SearchDTO } from './dto/search.dto';
import { CurrentWorkspace } from '../../decorators/current-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';

@UseGuards(JwtGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async pageSearch(
    @Query('type') type: string,
    @Body() searchDto: SearchDTO,
    @CurrentWorkspace() workspace: Workspace,
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
