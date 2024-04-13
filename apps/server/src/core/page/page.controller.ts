import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PageService } from './services/page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { PageHistoryIdDto, PageIdDto, SpaceIdDto } from './dto/page.dto';
import { PageOrderingService } from './services/page-ordering.service';
import { PageHistoryService } from './services/page-history.service';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { User, Workspace } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly pageOrderService: PageOrderingService,
    private readonly pageHistoryService: PageHistoryService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post()
  async getSpacePages(@Body() spaceIdDto: SpaceIdDto) {
    return this.pageService.getSidebarPagesBySpaceId(spaceIdDto.spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getPage(@Body() pageIdDto: PageIdDto) {
    return this.pageService.findById(pageIdDto.pageId);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(
    @Body() createPageDto: CreatePageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.pageService.create(user.id, workspace.id, createPageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() updatePageDto: UpdatePageDto, @AuthUser() user: User) {
    return this.pageService.update(
      updatePageDto.pageId,
      updatePageDto,
      user.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() pageIdDto: PageIdDto) {
    await this.pageService.forceDelete(pageIdDto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('restore')
  async restore(@Body() pageIdDto: PageIdDto) {
    //  await this.pageService.restore(deletePageDto.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('move')
  async movePage(@Body() movePageDto: MovePageDto) {
    return this.pageOrderService.movePage(movePageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('recent')
  async getRecentSpacePages(
    @Body() spaceIdDto: SpaceIdDto,
    @Body() pagination: PaginationOptions,
  ) {
    return this.pageService.getRecentSpacePages(spaceIdDto.spaceId, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('ordering')
  async getSpacePageOrder(@Body() spaceIdDto: SpaceIdDto) {
    return this.pageOrderService.getSpacePageOrder(spaceIdDto.spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('tree')
  async spacePageTree(@Body() spaceIdDto: SpaceIdDto) {
    return this.pageOrderService.convertToTree(spaceIdDto.spaceId);
  }

  // TODO: scope to workspaces
  @HttpCode(HttpStatus.OK)
  @Post('/history')
  async getPageHistory(
    @Body() dto: PageIdDto,
    @Body() pagination: PaginationOptions,
  ) {
    return this.pageHistoryService.findHistoryByPageId(dto.pageId, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/history/details')
  async get(@Body() dto: PageHistoryIdDto) {
    return this.pageHistoryService.findById(dto.historyId);
  }
}
