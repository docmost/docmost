import { BadRequestException } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareService } from './share.service';
import { LicenseCheckService } from '../../integrations/environment/license-check.service';
import { Workspace } from '@docmost/db/types/entity.types';
import { ShareInfoDto } from './dto/share.dto';

describe('ShareController - getSharedPageInfo', () => {
  const buildController = () => {
    const shareService = {
      getSharedPage: jest.fn(),
      isSharingAllowed: jest.fn(),
    } as unknown as jest.Mocked<ShareService>;

    const licenseCheckService = {
      resolveFeatures: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<LicenseCheckService>;

    const controller = new ShareController(
      shareService,
      {} as any, // shareRepo
      {} as any, // pageRepo
      {} as any, // pagePermissionRepo
      {} as any, // pageAccessService
      licenseCheckService,
      {} as any, // auditService
    );

    return { controller, shareService, licenseCheckService };
  };

  it('throws BadRequestException without touching the service when only shareId is provided', async () => {
    const { controller, shareService } = buildController();
    const dto = { shareId: 'some-share-key' } as ShareInfoDto;
    const workspace = { id: 'workspace-1' } as Workspace;

    await expect(
      controller.getSharedPageInfo(dto, workspace),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(shareService.getSharedPage).not.toHaveBeenCalled();
  });

  it('resolves the shared page when pageId is provided', async () => {
    const { controller, shareService, licenseCheckService } = buildController();
    shareService.getSharedPage.mockResolvedValue({
      page: { id: 'page-1' },
      share: { spaceId: 'space-1' },
    } as any);
    shareService.isSharingAllowed.mockResolvedValue(true);

    const dto = { pageId: 'page-1' } as ShareInfoDto;
    const workspace = {
      id: 'workspace-1',
      licenseKey: null,
      plan: 'free',
    } as unknown as Workspace;

    const result = await controller.getSharedPageInfo(dto, workspace);

    expect(shareService.getSharedPage).toHaveBeenCalledWith(dto, workspace.id);
    expect(licenseCheckService.resolveFeatures).toHaveBeenCalledWith(
      workspace.licenseKey,
      workspace.plan,
    );
    expect(result.page).toEqual({ id: 'page-1' });
  });
});
