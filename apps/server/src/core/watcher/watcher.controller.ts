import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { WatcherService } from './watcher.service.js';
import { AuthUser } from '../../common/decorators/auth-user.decorator.js';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { User, Workspace } from '@docmost/db/types/entity.types.js';
import { WatcherPageDto } from './dto/watcher.dto.js';
import { PageRepo } from '@docmost/db/repos/page/page.repo.js';
import { PageAccessService } from '../page/page-access/page-access.service.js';

@UseGuards(JwtAuthGuard)
@Controller('pages')
export class WatcherController {
  constructor(
    private readonly watcherService: WatcherService,
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('watch')
  async watchPage(
    @Body() dto: WatcherPageDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    await this.watcherService.watchPage(
      user.id,
      page.id,
      page.spaceId,
      workspace.id,
    );

    return { watching: true };
  }

  @HttpCode(HttpStatus.OK)
  @Post('unwatch')
  async unwatchPage(@Body() dto: WatcherPageDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    await this.watcherService.unwatchPage(
      user.id,
      page.id,
      page.spaceId,
      page.workspaceId,
    );

    return { watching: false };
  }

  @HttpCode(HttpStatus.OK)
  @Post('watch-status')
  async getWatchStatus(@Body() dto: WatcherPageDto, @AuthUser() user: User) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    const watching = await this.watcherService.isWatchingPage(user.id, page.id);

    return { watching };
  }
}
