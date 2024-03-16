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
import { PageDetailsDto } from './dto/page-details.dto';
import { DeletePageDto } from './dto/delete-page.dto';
import { PageOrderingService } from './services/page-ordering.service';
import { PageHistoryService } from './services/page-history.service';
import { HistoryDetailsDto } from './dto/history-details.dto';
import { PageHistoryDto } from './dto/page-history.dto';
import { AuthUser } from '../../decorators/auth-user.decorator';
import { User } from '../user/entities/user.entity';
import { AuthWorkspace } from '../../decorators/auth-workspace.decorator';
import { Workspace } from '../workspace/entities/workspace.entity';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly pageOrderService: PageOrderingService,
    private readonly pageHistoryService: PageHistoryService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/info')
  async getPage(@Body() input: PageDetailsDto) {
    return this.pageService.findOne(input.id);
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
    return this.pageService.update(updatePageDto.id, updatePageDto, user.id);
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
  async getRecentSpacePages(@Body() { spaceId }) {
    console.log(spaceId);
    return this.pageService.getRecentSpacePages(spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async getSpacePages(spaceId: string) {
    return this.pageService.getSidebarPagesBySpaceId(spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('ordering')
  async getSpacePageOrder(spaceId: string) {
    return this.pageOrderService.getSpacePageOrder(spaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('tree')
  async spacePageTree(@Body() { spaceId }) {
    return this.pageOrderService.convertToTree(spaceId);
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
