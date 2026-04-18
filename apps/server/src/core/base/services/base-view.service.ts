import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { CreateViewDto } from '../dto/create-view.dto';
import { UpdateViewDto, DeleteViewDto } from '../dto/update-view.dto';
import { viewConfigSchema } from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';
import { EventName } from '../../../common/events/event.contants';
import {
  BaseViewCreatedEvent,
  BaseViewDeletedEvent,
  BaseViewUpdatedEvent,
} from '../events/base-events';

@Injectable()
export class BaseViewService {
  constructor(
    private readonly baseViewRepo: BaseViewRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateViewDto) {
    let validatedConfig = {};
    if (dto.config) {
      const result = viewConfigSchema.safeParse(dto.config);
      if (!result.success) {
        throw new BadRequestException({
          message: 'Invalid view config',
          errors: result.error.issues.map((i) => i.message),
        });
      }
      validatedConfig = result.data;
    }

    const lastPosition = await this.baseViewRepo.getLastPosition(dto.baseId, {
      workspaceId,
    });
    const position = generateJitteredKeyBetween(lastPosition, null);

    const created = await this.baseViewRepo.insertView({
      baseId: dto.baseId,
      name: dto.name,
      type: dto.type ?? 'table',
      position,
      config: validatedConfig as any,
      workspaceId,
      creatorId: userId,
    });

    const event: BaseViewCreatedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId,
      requestId: null,
      view: created,
    };
    this.eventEmitter.emit(EventName.BASE_VIEW_CREATED, event);

    return created;
  }

  async update(dto: UpdateViewDto, workspaceId: string, userId?: string) {
    const view = await this.baseViewRepo.findById(dto.viewId, { workspaceId });
    if (!view) {
      throw new NotFoundException('View not found');
    }

    if (view.baseId !== dto.baseId) {
      throw new BadRequestException('View does not belong to this base');
    }

    let validatedConfig = undefined;
    if (dto.config !== undefined) {
      const result = viewConfigSchema.safeParse(dto.config);
      if (!result.success) {
        throw new BadRequestException({
          message: 'Invalid view config',
          errors: result.error.issues.map((i) => i.message),
        });
      }
      validatedConfig = result.data;
    }

    await this.baseViewRepo.updateView(
      dto.viewId,
      {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(validatedConfig !== undefined && { config: validatedConfig as any }),
      },
      { workspaceId },
    );

    const updated = await this.baseViewRepo.findById(dto.viewId, {
      workspaceId,
    });

    if (updated) {
      const event: BaseViewUpdatedEvent = {
        baseId: dto.baseId,
        workspaceId,
        actorId: userId ?? null,
        requestId: null,
        view: updated,
      };
      this.eventEmitter.emit(EventName.BASE_VIEW_UPDATED, event);
    }

    return updated;
  }

  async delete(dto: DeleteViewDto, workspaceId: string, userId?: string) {
    const view = await this.baseViewRepo.findById(dto.viewId, { workspaceId });
    if (!view) {
      throw new NotFoundException('View not found');
    }

    if (view.baseId !== dto.baseId) {
      throw new BadRequestException('View does not belong to this base');
    }

    const viewCount = await this.baseViewRepo.countByBaseId(dto.baseId, {
      workspaceId,
    });
    if (viewCount <= 1) {
      throw new BadRequestException('Cannot delete the last view');
    }

    await this.baseViewRepo.deleteView(dto.viewId, { workspaceId });

    const event: BaseViewDeletedEvent = {
      baseId: dto.baseId,
      workspaceId,
      actorId: userId ?? null,
      requestId: null,
      viewId: dto.viewId,
    };
    this.eventEmitter.emit(EventName.BASE_VIEW_DELETED, event);
  }

  async listByBaseId(baseId: string, workspaceId: string) {
    return this.baseViewRepo.findByBaseId(baseId, { workspaceId });
  }
}
