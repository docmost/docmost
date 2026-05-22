import {
  BadRequestException,
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
  FindPagesByLabelDto,
  LabelInfoDto,
  ListLabelsDto,
} from './dto/label.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { LabelRepo, LabelType } from '@docmost/db/repos/label/label.repo';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { emptyCursorPaginationResult } from '@docmost/db/pagination/cursor-pagination';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';

@UseGuards(JwtAuthGuard)
@Controller('labels')
export class LabelController {
  constructor(
    private readonly labelService: LabelService,
    private readonly labelRepo: LabelRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('/')
  async getLabels(
    @Body() dto: ListLabelsDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.labelService.getLabels(
      workspace.id,
      user.id,
      dto.type,
      pagination,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('pages')
  async findPagesByLabel(
    @Body() dto: FindPagesByLabelDto,
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (dto.spaceId) {
      await this.assertCanReadSpace(user, dto.spaceId);
    }

    let labelId = dto.labelId;
    if (!labelId) {
      if (!dto.name) {
        throw new BadRequestException('labelId or name is required');
      }
      const label = await this.labelRepo.findByNameAndWorkspace(
        dto.name,
        workspace.id,
        LabelType.PAGE,
      );
      if (!label) {
        return emptyCursorPaginationResult(pagination.limit);
      }
      labelId = label.id;
    } else {
      const label = await this.labelRepo.findById(labelId);
      if (!label) {
        throw new NotFoundException('Label not found');
      }
    }

    return this.labelService.findPagesByLabel(labelId, user.id, {
      spaceId: dto.spaceId,
      query: pagination.query,
      pagination,
    });
  }

  // @HttpCode(HttpStatus.OK)
  // @Post('info')
  // async getLabelInfo(
  //   @Body() dto: LabelInfoDto,
  //   @AuthUser() user: User,
  //   @AuthWorkspace() workspace: Workspace,
  // ) {
  //   if (dto.spaceId) {
  //     await this.assertCanReadSpace(user, dto.spaceId);
  //   }
  //
  //   return this.labelService.getLabelInfo(
  //     dto.name,
  //     dto.type,
  //     workspace.id,
  //     user.id,
  //     dto.spaceId,
  //   );
  // }

  private async assertCanReadSpace(user: User, spaceId: string) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
  }
}
