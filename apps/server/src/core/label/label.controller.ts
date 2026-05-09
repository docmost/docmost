import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LabelService } from './label.service';
import {
  AddLabelsDto,
  PageLabelsDto,
  RemoveLabelDto,
  SearchPagesByLabelDto,
} from './dto/label.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { LabelRepo } from '@docmost/db/repos/label/label.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelController {
  constructor(
    private readonly labelService: LabelService,
    private readonly labelRepo: LabelRepo,
    private readonly pageRepo: PageRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getLabels(
    @Body() pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.labelService.getLabels(workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('add')
  async addLabels(
    @Body() dto: AddLabelsDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.labelService.addLabelsToPage(
      page.id,
      dto.names,
      workspace.id,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('remove')
  async removeLabel(
    @Body() dto: RemoveLabelDto,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    await this.labelService.removeLabelFromPage(page.id, dto.labelId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('page')
  async getPageLabels(
    @Body() dto: PageLabelsDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
  ) {
    const page = await this.pageRepo.findById(dto.pageId);
    if (!page) {
      throw new NotFoundException('Page not found');
    }

    const ability = await this.spaceAbility.createForUser(user, page.spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return this.labelService.getPageLabels(page.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('search-pages')
  async searchPagesByLabel(
    @Body() dto: SearchPagesByLabelDto,
    @AuthUser() user: User,
  ) {
    const label = await this.labelRepo.findById(dto.labelId);
    if (!label) {
      throw new NotFoundException('Label not found');
    }

    if (dto.spaceId) {
      const ability = await this.spaceAbility.createForUser(user, dto.spaceId);
      if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
        throw new ForbiddenException();
      }
    }

    return this.labelService.searchPagesByLabel(label.id, user.id, {
      spaceId: dto.spaceId,
    });
  }
}
