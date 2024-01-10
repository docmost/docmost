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
import { JwtGuard } from '../auth/guards/JwtGuard';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { MovePageDto } from './dto/move-page.dto';
import { PageDetailsDto } from './dto/page-details.dto';
import { DeletePageDto } from './dto/delete-page.dto';
import { PageOrderingService } from './services/page-ordering.service';
import { PageHistoryService } from './services/page-history.service';
import { HistoryDetailsDto } from './dto/history-details.dto';
import { PageHistoryDto } from './dto/page-history.dto';
import { JwtUser } from '../../decorators/jwt-user.decorator';

@UseGuards(JwtGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly pageOrderService: PageOrderingService,
    private readonly pageHistoryService: PageHistoryService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/details')
  async getPage(@Body() input: PageDetailsDto) {
    return this.pageService.findOne(input.id);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(@JwtUser() jwtUser, @Body() createPageDto: CreatePageDto) {
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtUser.id)
    ).id;
    return this.pageService.create(jwtUser.id, workspaceId, createPageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@JwtUser() jwtUser, @Body() updatePageDto: UpdatePageDto) {
    return this.pageService.update(updatePageDto.id, updatePageDto, jwtUser.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('delete')
  async delete(@Body() deletePageDto: DeletePageDto) {
    await this.pageService.delete(deletePageDto.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('restore')
  async restore(@Body() deletePageDto: DeletePageDto) {
    await this.pageService.restore(deletePageDto.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('move')
  async movePage(@Body() movePageDto: MovePageDto) {
    return this.pageOrderService.movePage(movePageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('recent')
  async getRecentWorkspacePages(@JwtUser() jwtUser) {
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtUser.id)
    ).id;
    return this.pageService.getRecentWorkspacePages(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async getWorkspacePages(@JwtUser() jwtUser) {
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtUser.id)
    ).id;
    return this.pageService.getSidebarPagesByWorkspaceId(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('ordering')
  async getWorkspacePageOrder(@JwtUser() jwtUser) {
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtUser.id)
    ).id;
    return this.pageOrderService.getWorkspacePageOrder(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('tree')
  async workspacePageTree(@JwtUser() jwtUser) {
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtUser.id)
    ).id;

    return this.pageOrderService.convertToTree(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/history')
  async getPageHistory(@Body() dto: PageHistoryDto) {
    return this.pageHistoryService.findHistoryByPageId(dto.pageId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('/history/details')
  async get(@Body() dto: HistoryDetailsDto) {
    return this.pageHistoryService.findOne(dto.id);
  }
}
