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
  const service = new SpaceService(
    spaceRepo as any, {} as any, shareRepo as any, {} as any,
    {} as any, {} as any, {} as any, auditService as any,
  );
  return { service, spaceRepo, shareRepo, auditService };
}

describe('SpaceService archive', () => {
  it('archives an active space and records who archived it', async () => {
    const { service, spaceRepo, shareRepo, auditService } = buildService({ id: 'space-1', isPersonal: false, archivedAt: null });
    const result = await service.archiveSpace('space-1', 'user-1', 'ws-1');
    expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
      { archivedAt: expect.any(Date), archivedById: 'user-1' }, 'space-1', 'ws-1');
    expect(result.archivedAt).toBeInstanceOf(Date);
    expect(shareRepo.deleteBySpaceId).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
      event: AuditEvent.SPACE_ARCHIVED, resourceType: AuditResource.SPACE,
      resourceId: 'space-1', spaceId: 'space-1' }));
  });

  it('refuses to archive a personal space', async () => {
    const { service, spaceRepo } = buildService({ id: 'space-1', isPersonal: true, archivedAt: null });
    await expect(service.archiveSpace('space-1', 'user-1', 'ws-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(spaceRepo.updateSpace).not.toHaveBeenCalled();
  });

  it('returns an archived space unchanged when archived again', async () => {
    const archivedAt = new Date('2026-10-01');
    const { service, spaceRepo, auditService } = buildService({ id: 'space-1', isPersonal: false, archivedAt });
    await expect(service.archiveSpace('space-1', 'user-1', 'ws-1')).resolves.toMatchObject({ archivedAt });
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

  it('throws NotFound for a missing space', async () => {
    const { service } = buildService(undefined);
    await expect(service.archiveSpace('space-1', 'user-1', 'ws-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
