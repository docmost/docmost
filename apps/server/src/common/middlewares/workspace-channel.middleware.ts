import {
  ForbiddenException,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { EnvironmentService } from '../../integrations/environment/environment.service';
import { WorkspaceReleaseChannelRepo } from '@docmost/db/repos/workspace/workspace-release-channel.repo';

@Injectable()
export class WorkspaceChannelMiddleware implements NestMiddleware {
  private readonly logger = new Logger(WorkspaceChannelMiddleware.name);

  private readonly guardedPathSuffixes = new Set([
    '/pages/create',
    '/pages/update',
    '/pages/delete',
    '/pages/restore',
    '/pages/move',
    '/pages/move-to-space',
    '/pages/duplicate',
    '/pages/batch-move',
    '/pages/pin',
    '/pages/unpin',
    '/pages/folder-migration/start',
    '/pages/folder-migration/rollback',
    '/workspace/update',
    '/workspace/release-channel',
  ]);

  constructor(
    private readonly env: EnvironmentService,
    private readonly workspaceReleaseChannelRepo: WorkspaceReleaseChannelRepo,
  ) {}

  async use(
    req: FastifyRequest['raw'],
    _res: FastifyReply['raw'],
    next: () => void,
  ) {
    if (!this.shouldGuardRequest(req)) {
      return next();
    }

    const workspaceId = (req as any).workspaceId;
    if (!workspaceId) {
      return next();
    }

    try {
      const appChannel = this.env.getAppChannel();
      const workspaceChannel =
        await this.workspaceReleaseChannelRepo.getReleaseChannel(workspaceId);

      if (workspaceChannel !== appChannel) {
        throw new ForbiddenException('WORKSPACE_CHANNEL_MISMATCH');
      }
    } catch (err) {
      if (this.isMissingTableError(err)) {
        // Keep compatibility while DB migrations are being rolled out.
        this.logger.warn(
          'workspace_release_channel table is missing, skipping channel guard.',
        );
        return next();
      }

      throw err;
    }

    next();
  }

  private shouldGuardRequest(req: FastifyRequest['raw']) {
    if (req.method !== 'POST') {
      return false;
    }

    const path = req.url?.split('?')?.[0] ?? '';
    for (const suffix of this.guardedPathSuffixes) {
      if (path.endsWith(suffix)) {
        return true;
      }
    }
    return false;
  }

  private isMissingTableError(err: unknown) {
    const pgErr = err as { code?: string };
    return pgErr?.code === '42P01';
  }
}
