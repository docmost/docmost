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
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User } from '@docmost/db/types/entity.types';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { FileTaskIdDto } from './dto/file-task-dto';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';

@Controller('file-tasks')
export class FileTaskController {
  constructor(
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly spaceAbility: SpaceAbilityFactory,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post()
  async getFileTasks(@AuthUser() user: User) {
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(user.id);

    if (!userSpaceIds || userSpaceIds.length === 0) {
      return [];
    }

    const fileTasks = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('spaceId', 'in', userSpaceIds)
      .execute();

    if (!fileTasks) {
      throw new NotFoundException('File task not found');
    }

    return fileTasks;
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('info')
  async getFileTask(@Body() dto: FileTaskIdDto, @AuthUser() user: User) {
    const fileTask = await this.db
      .selectFrom('fileTasks')
      .selectAll()
      .where('id', '=', dto.fileTaskId)
      .executeTakeFirst();

    if (!fileTask || !fileTask.spaceId) {
      throw new NotFoundException('File task not found');
    }

    const ability = await this.spaceAbility.createForUser(
      user,
      fileTask.spaceId,
    );
    if (ability.cannot(SpaceCaslAction.Read, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }

    return fileTask;
  }
}
