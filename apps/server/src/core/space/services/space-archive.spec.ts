import { BadRequestException } from '@nestjs/common';
import { SpaceService } from './space.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';

function buildService(overrides: Record<string, unknown> = {}) {
  const space = { id: 'space-1', workspaceId: 'ws-1', isPersonal: false, archivedAt: null, ...overrides } as any;
  const spaceRepo = {
    updateSpace: jest.fn().mockImplementation(async (values) => ({ ...space, ...values })),
  };
  const shareRepo = { deleteBySpaceId: jest.fn() };
  const auditService = { log: jest.fn() };
  const wsService = { emitToSpace: jest.fn() };
  const service = new SpaceService(
    spaceRepo as any, {} as any, shareRepo as any, {} as any,
    {} as any, {} as any, {} as any, auditService as any, wsService as any,
    {} as any, {} as any,
  );
  return { service, space, spaceRepo, shareRepo, auditService, wsService };
}

const user = { id: 'user-1', name: 'Ada', avatarUrl: null } as any;
const archivedBy = { id: 'user-1', name: 'Ada', avatarUrl: null };

describe('SpaceService archive', () => {
  it('archives an active space and records who archived it', async () => {
    const { service, space, spaceRepo, shareRepo, auditService } = buildService();
    const result = await service.archiveSpace(space, user);
    expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
      { archivedAt: expect.any(Date), archivedById: 'user-1' }, 'space-1', 'ws-1');
    expect(result.archivedAt).toBeInstanceOf(Date);
    expect(result.archivedBy).toEqual(archivedBy);
    expect(shareRepo.deleteBySpaceId).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      event: AuditEvent.SPACE_ARCHIVED, resourceType: AuditResource.SPACE,
      resourceId: 'space-1', spaceId: 'space-1' }));
  });

  it('refuses to archive a personal space', async () => {
    const { service, space, spaceRepo } = buildService({ isPersonal: true });
    await expect(service.archiveSpace(space, user)).rejects.toBeInstanceOf(BadRequestException);
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
  });

  it('returns an archived space unchanged when archived again', async () => {
    const archivedAt = new Date('2026-10-01');
    const { service, space, spaceRepo, auditService } = buildService({ archivedAt });
    await expect(service.archiveSpace(space, user)).resolves.toMatchObject({ archivedAt });
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('unarchives an archived space', async () => {
    const { service, space, spaceRepo, auditService } = buildService({ archivedAt: new Date() });
    await service.unarchiveSpace(space);
    expect(spaceRepo.updateSpace).toHaveBeenCalledWith({ archivedAt: null, archivedById: null }, 'space-1', 'ws-1');
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ event: AuditEvent.SPACE_UNARCHIVED }));
  });

  it('returns an active space unchanged when unarchived', async () => {
    const { service, space, spaceRepo } = buildService();
    await service.unarchiveSpace(space);
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
  });

  it('tells connected members when a space is archived', async () => {
    const { service, space, wsService } = buildService();
    await service.archiveSpace(space, user);
    expect(wsService.emitToSpace).toHaveBeenCalledWith('space-1', {
      operation: 'spaceArchiveUpdated', spaceId: 'space-1', archivedAt: expect.any(Date), archivedBy });
  });

  it('tells connected members when a space is unarchived', async () => {
    const { service, space, wsService } = buildService({ archivedAt: new Date() });
    await service.unarchiveSpace(space);
    expect(wsService.emitToSpace).toHaveBeenCalledWith('space-1', {
      operation: 'spaceArchiveUpdated', spaceId: 'space-1', archivedAt: null, archivedBy: null });
  });

  it('sends nothing when the archive state does not change', async () => {
    const archived = buildService({ archivedAt: new Date() });
    await archived.service.archiveSpace(archived.space, user);
    expect(archived.wsService.emitToSpace).not.toHaveBeenCalled();

    const active = buildService();
    await active.service.unarchiveSpace(active.space);
    expect(active.wsService.emitToSpace).not.toHaveBeenCalled();
  });
});
