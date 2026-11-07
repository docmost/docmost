import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SpaceService } from './space.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';

function buildService(space: any) {
  const spaceRepo = {
    findById: jest.fn().mockResolvedValue(space),
    updateSpace: jest.fn().mockImplementation(async (values) => ({ ...space, ...values })),
  };
  const shareRepo = { deleteBySpaceId: jest.fn() };
  const auditService = { log: jest.fn() };
  const wsService = { emitToSpace: jest.fn() };
  const service = new SpaceService(
    spaceRepo as any, {} as any, shareRepo as any, {} as any,
    {} as any, {} as any, {} as any, auditService as any, wsService as any,
  );
  return { service, spaceRepo, shareRepo, auditService, wsService };
}

const user = { id: 'user-1', name: 'Ada', avatarUrl: null } as any;
const archivedBy = { id: 'user-1', name: 'Ada', avatarUrl: null };

describe('SpaceService archive', () => {
  it('archives an active space and records who archived it', async () => {
    const { service, spaceRepo, shareRepo, auditService } = buildService({ id: 'space-1', isPersonal: false, archivedAt: null });
    const result = await service.archiveSpace('space-1', user, 'ws-1');
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
    const { service, spaceRepo } = buildService({ id: 'space-1', isPersonal: true, archivedAt: null });
    await expect(service.archiveSpace('space-1', user, 'ws-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
  });

  it('returns an archived space unchanged when archived again', async () => {
    const archivedAt = new Date('2026-10-01');
    const { service, spaceRepo, auditService } = buildService({ id: 'space-1', isPersonal: false, archivedAt });
    await expect(service.archiveSpace('space-1', user, 'ws-1')).resolves.toMatchObject({ archivedAt });
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('unarchives an archived space', async () => {
    const { service, spaceRepo, auditService } = buildService({ id: 'space-1', isPersonal: false, archivedAt: new Date() });
    await service.unarchiveSpace('space-1', 'ws-1');
    expect(spaceRepo.updateSpace).toHaveBeenCalledWith({ archivedAt: null, archivedById: null }, 'space-1', 'ws-1');
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ event: AuditEvent.SPACE_UNARCHIVED }));
  });

  it('returns an active space unchanged when unarchived', async () => {
    const { service, spaceRepo } = buildService({ id: 'space-1', isPersonal: false, archivedAt: null });
    await service.unarchiveSpace('space-1', 'ws-1');
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
  });

  it('tells connected members when a space is archived', async () => {
    const { service, wsService } = buildService({ id: 'space-1', isPersonal: false, archivedAt: null });
    await service.archiveSpace('space-1', user, 'ws-1');
    expect(wsService.emitToSpace).toHaveBeenCalledWith('space-1', {
      operation: 'spaceArchiveUpdated', spaceId: 'space-1', archivedAt: expect.any(Date), archivedBy });
  });

  it('tells connected members when a space is unarchived', async () => {
    const { service, wsService } = buildService({ id: 'space-1', isPersonal: false, archivedAt: new Date() });
    await service.unarchiveSpace('space-1', 'ws-1');
    expect(wsService.emitToSpace).toHaveBeenCalledWith('space-1', {
      operation: 'spaceArchiveUpdated', spaceId: 'space-1', archivedAt: null, archivedBy: null });
  });

  it('sends nothing when the archive state does not change', async () => {
    const archived = buildService({ id: 'space-1', isPersonal: false, archivedAt: new Date() });
    await archived.service.archiveSpace('space-1', user, 'ws-1');
    expect(archived.wsService.emitToSpace).not.toHaveBeenCalled();

    const active = buildService({ id: 'space-1', isPersonal: false, archivedAt: null });
    await active.service.unarchiveSpace('space-1', 'ws-1');
    expect(active.wsService.emitToSpace).not.toHaveBeenCalled();
  });

  it('throws NotFound for a missing space', async () => {
    const { service } = buildService(undefined);
    await expect(service.archiveSpace('space-1', user, 'ws-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
