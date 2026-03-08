import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';
import { CreateViewDto } from '../dto/create-view.dto';
import { UpdateViewDto, DeleteViewDto } from '../dto/update-view.dto';
import { viewConfigSchema } from '../base.schemas';
import { generateJitteredKeyBetween } from 'fractional-indexing-jittered';

@Injectable()
export class BaseViewService {
  constructor(private readonly baseViewRepo: BaseViewRepo) {}

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

    const lastPosition = await this.baseViewRepo.getLastPosition(dto.baseId);
    const position = generateJitteredKeyBetween(lastPosition, null);

    return this.baseViewRepo.insertView({
      baseId: dto.baseId,
      name: dto.name,
      type: dto.type ?? 'table',
      position,
      config: validatedConfig as any,
      workspaceId,
      creatorId: userId,
    });
  }

  async update(dto: UpdateViewDto) {
    const view = await this.baseViewRepo.findById(dto.viewId);
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

    await this.baseViewRepo.updateView(dto.viewId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(validatedConfig !== undefined && { config: validatedConfig as any }),
    });

    return this.baseViewRepo.findById(dto.viewId);
  }

  async delete(dto: DeleteViewDto) {
    const view = await this.baseViewRepo.findById(dto.viewId);
    if (!view) {
      throw new NotFoundException('View not found');
    }

    if (view.baseId !== dto.baseId) {
      throw new BadRequestException('View does not belong to this base');
    }

    const viewCount = await this.baseViewRepo.countByBaseId(dto.baseId);
    if (viewCount <= 1) {
      throw new BadRequestException('Cannot delete the last view');
    }

    await this.baseViewRepo.deleteView(dto.viewId);
  }

  async listByBaseId(baseId: string) {
    return this.baseViewRepo.findByBaseId(baseId);
  }
}
