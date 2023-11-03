import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PageService } from './services/page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FastifyRequest } from 'fastify';
import { JwtGuard } from '../auth/guards/JwtGuard';
import { WorkspaceService } from '../workspace/services/workspace.service';
import { MovePageDto } from './dto/move-page.dto';
import { PageDetailsDto } from './dto/page-details.dto';
import { DeletePageDto } from './dto/delete-page.dto';
import { PageOrderingService } from './services/page-ordering.service';

@UseGuards(JwtGuard)
@Controller('pages')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly pageOrderService: PageOrderingService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/details')
  async getPage(@Body() input: PageDetailsDto) {
    return this.pageService.findWithoutYDoc(input.id);
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('create')
  async create(
    @Req() req: FastifyRequest,
    @Body() createPageDto: CreatePageDto,
  ) {
    const jwtPayload = req['user'];
    const userId = jwtPayload.sub;

    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;
    return this.pageService.create(userId, workspaceId, createPageDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(@Body() updatePageDto: UpdatePageDto) {
    return this.pageService.update(updatePageDto.id, updatePageDto);
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
  @Post()
  async getWorkspacePages(@Req() req: FastifyRequest) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;
    return this.pageService.getByWorkspaceId(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('ordering')
  async getWorkspacePageOrder(@Req() req: FastifyRequest) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;
    return this.pageOrderService.getWorkspacePageOrder(workspaceId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('tree')
  async workspacePageTree(@Req() req: FastifyRequest) {
    const jwtPayload = req['user'];
    const workspaceId = (
      await this.workspaceService.getUserCurrentWorkspace(jwtPayload.sub)
    ).id;

    return this.pageOrderService.convertToTree(workspaceId);
  }
}
