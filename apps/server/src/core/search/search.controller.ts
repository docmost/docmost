import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtUser } from '../../decorators/jwt-user.decorator';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { JwtGuard } from '../auth/guards/JwtGuard';
import { SearchService } from './search.service';
import { SearchDTO } from './dto/search.dto';

@UseGuards(JwtGuard)
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async pageSearch(
    @Query('type') type: string,
    @Body() searchDto: SearchDTO,
    @JwtUser() jwtUser,
  ) {
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtUser.id)
    ).id;

    if (!type || type === 'page') {
      return this.searchService.searchPage(
        searchDto.query,
        searchDto,
        workspaceId,
      );
    }
    return;
  }
}
