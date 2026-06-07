import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { RedisService } from '@nestjs-labs/nestjs-ioredis';
import { OrganizeService } from './organize.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../casl/interfaces/space-ability.type';
import {
  AddOrganizeEventDto,
  CreateOrganizeTaskDto,
  OrganizeShareTokenDto,
  OrganizeTaskIdDto,
  UpdateOrganizeTaskDto,
} from './dto/organize.dto';

@UseGuards(JwtAuthGuard)
@Controller('organize-tasks')
export class OrganizeController {
  constructor(
    private readonly organizeService: OrganizeService,
    private readonly spaceAbility: SpaceAbilityFactory,
    private readonly redisService: RedisService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async create(
    @Body() dto: CreateOrganizeTaskDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    if (dto.spaceId) {
      await this.assertCanEditSpace(user, dto.spaceId);
    }
    return this.organizeService.create(user, workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('info')
  async info(
    @Body() dto: OrganizeTaskIdDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.getInfo(dto.organizeTaskId, workspace.id);
  }

  // SSE relay: streams the agent's progress events to the live UI panel (A3 g).
  // GET so it works with EventSource (browser, cookie auth) and bearer fetch (agents).
  @Get(':id/stream')
  async stream(
    @Param('id') id: string,
    @AuthWorkspace() workspace: Workspace,
    @Res() reply: FastifyReply,
  ) {
    // resolves 404 if the task is not in the caller's workspace
    const detail = await this.organizeService.getInfo(id, workspace.id);

    reply.raw.setHeader('content-type', 'text/event-stream');
    reply.raw.setHeader('cache-control', 'no-cache, no-transform');
    reply.raw.setHeader('connection', 'keep-alive');
    reply.hijack();

    const send = (payload: unknown) =>
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);

    // initial snapshot so a late subscriber catches up immediately
    send({ type: 'snapshot', task: detail });

    if (detail.status === 'succeeded' || detail.status === 'failed') {
      send({ type: 'done', status: detail.status });
      reply.raw.end();
      return;
    }

    const subscriber = this.redisService.getOrThrow().duplicate();
    const channel = OrganizeService.channel(id);

    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 25000);
    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(ping);
      subscriber.unsubscribe(channel).catch(() => undefined);
      subscriber.quit().catch(() => undefined);
    };

    subscriber.on('message', (_channel, message) => {
      reply.raw.write(`data: ${message}\n\n`);
      try {
        if (JSON.parse(message)?.type === 'done') {
          reply.raw.end();
          cleanup();
        }
      } catch {
        // non-JSON payloads are ignored for close detection
      }
    });

    await subscriber.subscribe(channel);
    reply.raw.on('close', cleanup);
  }

  @HttpCode(HttpStatus.OK)
  @Post('by-token')
  async byToken(
    @Body() dto: OrganizeShareTokenDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.getByShareToken(dto.shareToken, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateOrganizeTaskDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.update(workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('events')
  async addEvent(
    @Body() dto: AddOrganizeEventDto,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.addEvent(workspace.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async list(
    @Body() pagination: PaginationOptions,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.organizeService.list(workspace.id, pagination);
  }

  private async assertCanEditSpace(user: User, spaceId: string) {
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Edit, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
  }
}
