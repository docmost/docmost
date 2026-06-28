import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { GroupRepo } from '@docmost/db/repos/group/group.repo';
import { nanoIdGen } from '../../common/helpers';
import { UserRole } from '../../common/helpers/types/permission';

@Injectable()
export class ScimProvisioningService {
  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
    private readonly groupRepo: GroupRepo,
  ) {}

  private mapUser(user: any) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.scimExternalId ?? undefined,
      userName: user.email,
      name: { formatted: user.name },
      emails: [{ value: user.email, primary: true }],
      active: !user.deactivatedAt && !user.deletedAt,
      meta: {
        resourceType: 'User',
        created: user.createdAt,
        lastModified: user.updatedAt,
      },
    };
  }

  private mapGroup(group: any, members: string[] = []) {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: group.id,
      externalId: group.scimExternalId ?? undefined,
      displayName: group.name,
      members: members.map((id) => ({ value: id })),
      meta: {
        resourceType: 'Group',
        created: group.createdAt,
        lastModified: group.updatedAt,
      },
    };
  }

  async listUsers(workspaceId: string, startIndex = 1, count = 100) {
    const rows = await this.db
      .selectFrom('users')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .offset(Math.max(0, startIndex - 1))
      .limit(count)
      .execute();

    const total = await this.db
      .selectFrom('users')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: Number(total?.count ?? 0),
      startIndex,
      itemsPerPage: count,
      Resources: rows.map((u) => this.mapUser(u)),
    };
  }

  async getUser(workspaceId: string, userId: string) {
    const user = await this.userRepo.findById(userId, workspaceId, {
      includeScimExternalId: true,
    });
    if (!user) throw new NotFoundException();
    return this.mapUser(user);
  }

  async createUser(workspaceId: string, body: any) {
    const email =
      body?.emails?.[0]?.value || body?.userName || body?.email;
    if (!email) {
      throw new BadRequestException('userName or emails required');
    }
    const existing = await this.userRepo.findByEmail(email, workspaceId);
    if (existing) {
      return this.mapUser(existing);
    }
    const user = await this.userRepo.insertUser({
      email,
      name: body?.name?.formatted || body?.displayName || email.split('@')[0],
      password: nanoIdGen(16),
      role: UserRole.MEMBER,
      workspaceId,
      scimExternalId: body?.externalId ?? null,
      hasGeneratedPassword: true,
    } as any);
    return this.mapUser(user);
  }

  async replaceUser(workspaceId: string, userId: string, body: any) {
    const user = await this.userRepo.findById(userId, workspaceId);
    if (!user) throw new NotFoundException();
    const email = body?.emails?.[0]?.value || body?.userName || user.email;
    await this.userRepo.updateUser(
      {
        email,
        name: body?.name?.formatted || user.name,
        deactivatedAt: body?.active === false ? new Date() : null,
        scimExternalId: body?.externalId ?? user.scimExternalId,
      } as any,
      userId,
      workspaceId,
    );
    return this.getUser(workspaceId, userId);
  }

  async deleteUser(workspaceId: string, userId: string) {
    await this.userRepo.updateUser(
      { deletedAt: new Date() } as any,
      userId,
      workspaceId,
    );
  }

  async listGroups(workspaceId: string, startIndex = 1, count = 100) {
    const groups = await this.db
      .selectFrom('groups')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .orderBy('createdAt', 'asc')
      .offset(Math.max(0, startIndex - 1))
      .limit(count)
      .execute();

    const resources = [];
    for (const group of groups) {
      const members = await this.db
        .selectFrom('groupUsers')
        .select('userId')
        .where('groupId', '=', group.id)
        .execute();
      resources.push(
        this.mapGroup(
          group,
          members.map((m) => m.userId),
        ),
      );
    }

    const total = await this.db
      .selectFrom('groups')
      .select((eb) => eb.fn.count('id').as('count'))
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: Number(total?.count ?? 0),
      startIndex,
      itemsPerPage: count,
      Resources: resources,
    };
  }

  async getGroup(workspaceId: string, groupId: string) {
    const group = await this.groupRepo.findById(groupId, workspaceId, {
      includeScimExternalId: true,
    });
    if (!group) throw new NotFoundException();
    const members = await this.db
      .selectFrom('groupUsers')
      .select('userId')
      .where('groupId', '=', groupId)
      .execute();
    return this.mapGroup(
      group,
      members.map((m) => m.userId),
    );
  }

  async createGroup(workspaceId: string, body: any) {
    const name = body?.displayName;
    if (!name) throw new BadRequestException('displayName required');
    const group = await this.groupRepo.insertGroup({
      name,
      workspaceId,
      scimExternalId: body?.externalId ?? null,
      isDefault: false,
      isExternal: true,
    } as any);
    return this.mapGroup(group, []);
  }

  async replaceGroup(workspaceId: string, groupId: string, body: any) {
    const group = await this.groupRepo.findById(groupId, workspaceId);
    if (!group) throw new NotFoundException();
    await this.groupRepo.update(
      {
        name: body?.displayName || group.name,
        scimExternalId: body?.externalId ?? group.scimExternalId,
      } as any,
      groupId,
      workspaceId,
    );
    return this.getGroup(workspaceId, groupId);
  }

  async deleteGroup(workspaceId: string, groupId: string) {
    await this.groupRepo.update(
      { deletedAt: new Date() } as any,
      groupId,
      workspaceId,
    );
  }
}
