import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceService } from '../../core/space/services/space.service';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { User } from '@docmost/db/types/entity.types';
import slugify from '@sindresorhus/slugify';
import { v7 as uuid7 } from 'uuid';

@Injectable()
export class PersonalSpaceService {
  constructor(
    private readonly spaceRepo: SpaceRepo,
    private readonly spaceService: SpaceService,
    private readonly workspaceRepo: WorkspaceRepo,
  ) {}

  async getInfo(user: User, workspaceId: string) {
    const space = await this.spaceRepo.findPersonalSpace(user.id, workspaceId);
    return space ?? null;
  }

  async create(
    user: User,
    workspaceId: string,
    data: { name?: string },
  ) {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    const settings = (workspace?.settings ?? {}) as Record<string, any>;
    if (!settings?.spaces?.allowPersonal) {
      throw new ForbiddenException('Personal spaces are not enabled');
    }

    const existing = await this.spaceRepo.findPersonalSpace(
      user.id,
      workspaceId,
    );
    if (existing) {
      throw new BadRequestException('Personal space already exists');
    }

    const name = data.name?.trim() || `${user.name}'s space`;
    let slug = slugify(name, { lowercase: true });
    if (!slug) slug = `personal-${uuid7().slice(0, 8)}`;

    let suffix = 0;
    while (await this.spaceRepo.slugExists(slug, workspaceId)) {
      suffix += 1;
      slug = `${slugify(name, { lowercase: true }) || 'personal'}-${suffix}`;
    }

    return this.spaceService.createSpace(
      user,
      workspaceId,
      { name, slug, description: '' },
      undefined,
      { isPersonal: true },
    );
  }
}
