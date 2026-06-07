import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import type { Redis } from 'ioredis';
import { OrganizeRepo } from '@docmost/db/repos/organize/organize.repo';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import {
  OrganizeEvent,
  OrganizeTask,
  User,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import {
  AddOrganizeEventDto,
  CreateOrganizeTaskDto,
  UpdateOrganizeTaskDto,
} from './dto/organize.dto';

const generateShareToken = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  32,
);

export interface OrganizeTaskWithUrl extends OrganizeTask {
  statusUrl: string;
}

export interface OrganizeTaskDetail extends OrganizeTaskWithUrl {
  events: OrganizeEvent[];
}

@Injectable()
export class OrganizeService {
  private readonly publisher: Redis;

  constructor(
    private readonly organizeRepo: OrganizeRepo,
    private readonly environmentService: EnvironmentService,
    private readonly redisService: RedisService,
  ) {
    this.publisher = this.redisService.getOrThrow();
  }

  /** Redis pub/sub channel that carries an organize task's live events. */
  static channel(organizeTaskId: string): string {
    return `organize:${organizeTaskId}`;
  }

  private publish(organizeTaskId: string, payload: unknown): void {
    this.publisher
      .publish(OrganizeService.channel(organizeTaskId), JSON.stringify(payload))
      .catch(() => {
        // a failed relay must never break the write path
      });
  }

  private statusUrl(shareToken: string): string {
    return `${this.environmentService.getAppUrl()}/organize/${shareToken}`;
  }

  private withUrl(task: OrganizeTask): OrganizeTaskWithUrl {
    return { ...task, statusUrl: this.statusUrl(task.shareToken) };
  }

  async create(
    user: User,
    workspaceId: string,
    dto: CreateOrganizeTaskDto,
  ): Promise<OrganizeTaskWithUrl> {
    const task = await this.organizeRepo.insert({
      workspaceId,
      spaceId: dto.spaceId ?? null,
      creatorId: user.id,
      source: dto.source ?? 'upload',
      status: 'open',
      title: dto.title ?? null,
      total: dto.total ?? null,
      fileTaskId: dto.fileTaskId ?? null,
      shareToken: generateShareToken(),
    });
    return this.withUrl(task);
  }

  private async getTaskOrThrow(
    organizeTaskId: string,
    workspaceId: string,
  ): Promise<OrganizeTask> {
    const task = await this.organizeRepo.findById(organizeTaskId, workspaceId);
    if (!task) {
      throw new NotFoundException('Organize task not found');
    }
    return task;
  }

  async getInfo(
    organizeTaskId: string,
    workspaceId: string,
  ): Promise<OrganizeTaskDetail> {
    const task = await this.getTaskOrThrow(organizeTaskId, workspaceId);
    const events = await this.organizeRepo.findEvents(task.id);
    return { ...this.withUrl(task), events };
  }

  async getByShareToken(
    shareToken: string,
    workspaceId: string,
  ): Promise<OrganizeTaskDetail> {
    const task = await this.organizeRepo.findByShareToken(
      shareToken,
      workspaceId,
    );
    if (!task) {
      throw new NotFoundException('Organize task not found');
    }
    const events = await this.organizeRepo.findEvents(task.id);
    return { ...this.withUrl(task), events };
  }

  async update(
    workspaceId: string,
    dto: UpdateOrganizeTaskDto,
  ): Promise<OrganizeTaskWithUrl> {
    await this.getTaskOrThrow(dto.organizeTaskId, workspaceId);
    const updated = await this.organizeRepo.update(
      {
        status: dto.status,
        total: dto.total,
        completed: dto.completed,
        error: dto.error,
      },
      dto.organizeTaskId,
      workspaceId,
    );
    if (updated.status === 'succeeded' || updated.status === 'failed') {
      this.publish(updated.id, {
        type: 'done',
        status: updated.status,
        completed: updated.completed,
        total: updated.total,
        error: updated.error,
      });
    }
    return this.withUrl(updated);
  }

  async addEvent(
    workspaceId: string,
    dto: AddOrganizeEventDto,
  ): Promise<{ event: OrganizeEvent; task: OrganizeTaskWithUrl }> {
    const task = await this.getTaskOrThrow(dto.organizeTaskId, workspaceId);

    const event = await this.organizeRepo.insertEvent({
      organizeTaskId: task.id,
      pageId: dto.pageId ?? null,
      title: dto.title ?? null,
      step: dto.step,
      status: dto.status ?? 'done',
      detail: dto.detail ? JSON.stringify(dto.detail) : null,
    });

    // first event flips an open task to running; progress events bump the counter
    const patch: { status?: string; completed?: number } = {};
    if (task.status === 'open') {
      patch.status = 'running';
    }
    if (dto.countsAsProgress) {
      patch.completed = (task.completed ?? 0) + 1;
    }

    let updatedTask = task;
    if (patch.status !== undefined || patch.completed !== undefined) {
      updatedTask = await this.organizeRepo.update(
        patch,
        task.id,
        workspaceId,
      );
    }

    // relay to any live SSE subscribers (the frontend "Organizing…" panel)
    this.publish(task.id, {
      type: 'event',
      event,
      completed: updatedTask.completed,
      total: updatedTask.total,
      status: updatedTask.status,
    });

    return { event, task: this.withUrl(updatedTask) };
  }

  async list(workspaceId: string, pagination: PaginationOptions) {
    if (pagination.limit > 100) {
      throw new BadRequestException('limit cannot exceed 100');
    }
    return this.organizeRepo.getTasksPaginated(workspaceId, pagination);
  }
}
