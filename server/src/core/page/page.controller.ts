import {
  Controller,
  Post,
  Body,
  Delete,
  Get,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PageService } from './page.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { FastifyRequest } from 'fastify';
import { JwtGuard } from '../auth/guards/JwtGuard';
import { WorkspaceService } from '../workspace/services/workspace.service';

@UseGuards(JwtGuard)
@Controller('page')
export class PageController {
  constructor(
    private readonly pageService: PageService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @Get('/info/:id')
  async getPage(@Param('id') pageId: string) {
    return this.pageService.findById(pageId);
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

    //const workspaceId = 'f9a12ec1-6b94-4191-b1d7-32ab93b330dc';
    return this.pageService.create(userId, workspaceId, createPageDto);
  }

  @Post('update/:id')
  async update(
    @Param('id') pageId: string,
    @Body() updatePageDto: UpdatePageDto,
  ) {
    return this.pageService.update(pageId, updatePageDto);
  }

  @Delete('delete/:id')
  async delete(@Param('id') pageId: string) {
    await this.pageService.delete(pageId);
  }
}
