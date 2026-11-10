import { ShareService } from './share.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const ATTACHMENT_ID = '019a1f00-0000-7000-8000-0000000000aa';

function makeService() {
  const tokenService = {
    generateAttachmentToken: jest.fn(async () => 'signed.token'),
  };
  const service = new ShareService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    tokenService as any,
    {} as any,
  );
  return { service, tokenService };
}

function page(coverPhoto: string | null) {
  return { id: PAGE_ID, workspaceId: WORKSPACE_ID, coverPhoto } as any;
}

describe('ShareService.updatePublicCoverPhoto', () => {
  it('rewrites an uploaded cover to a public link scoped to the page', async () => {
    const { service, tokenService } = makeService();

    const url = await service.updatePublicCoverPhoto(
      page(`/api/files/${ATTACHMENT_ID}/team-offsite.jpg`),
    );

    expect(url).toBe(
      `/api/files/public/${ATTACHMENT_ID}/team-offsite.jpg?jwt=signed.token`,
    );
    expect(tokenService.generateAttachmentToken).toHaveBeenCalledWith({
      attachmentId: ATTACHMENT_ID,
      pageId: PAGE_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  it.each([['preset:gradient-aurora'], [null]])(
    'returns %s unchanged without minting a token',
    async (coverPhoto) => {
      const { service, tokenService } = makeService();

      expect(await service.updatePublicCoverPhoto(page(coverPhoto))).toBe(
        coverPhoto,
      );
      expect(tokenService.generateAttachmentToken).not.toHaveBeenCalled();
    },
  );
});
