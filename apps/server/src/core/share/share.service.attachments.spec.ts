import { ShareService } from './share.service';

const WORKSPACE_ID = '019a1f00-0000-7000-8000-000000000001';
const PAGE_ID = '019a1f00-0000-7000-8000-000000000003';
const FILE_ID = '019a1f00-0000-7000-8000-0000000000aa';
const OTHER_FILE_ID = '019a1f00-0000-7000-8000-0000000000bb';

function makeService() {
  const tokenService = {
    generateAttachmentToken: jest.fn(
      async ({ attachmentId }: { attachmentId: string }) =>
        `token-${attachmentId}`,
    ),
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

const publicUrl = (id: string, name: string) =>
  `/api/files/public/${id}/${name}?jwt=token-${id}`;

async function share(...content: unknown[]) {
  const { service, tokenService } = makeService();
  const shared = await service.updatePublicAttachments({
    id: PAGE_ID,
    workspaceId: WORKSPACE_ID,
    content: { type: 'doc', content },
  } as any);
  return {
    attrs: shared.content.map((node: any) => node.attrs),
    tokenService,
  };
}

describe('ShareService.updatePublicAttachments', () => {
  it('rewrites the url of an attachment node to a public link scoped to the page', async () => {
    const { attrs, tokenService } = await share(
      {
        type: 'image',
        attrs: { attachmentId: FILE_ID, src: `/api/files/${FILE_ID}/cat.png` },
      },
      {
        type: 'attachment',
        attrs: {
          attachmentId: OTHER_FILE_ID,
          url: `/api/files/${OTHER_FILE_ID}/report.pdf`,
          name: 'report.pdf',
        },
      },
    );

    expect(attrs[0].src).toBe(publicUrl(FILE_ID, 'cat.png'));
    expect(attrs[1].url).toBe(publicUrl(OTHER_FILE_ID, 'report.pdf'));
    expect(tokenService.generateAttachmentToken).toHaveBeenCalledWith({
      attachmentId: FILE_ID,
      pageId: PAGE_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  it('serves an absolute file url from the share itself', async () => {
    const { attrs } = await share({
      type: 'image',
      attrs: {
        attachmentId: FILE_ID,
        src: `https://docs.example.com/api/files/${FILE_ID}/cat.png`,
      },
    });

    expect(attrs[0].src).toBe(publicUrl(FILE_ID, 'cat.png'));
  });

  it('reads the attachment from the file url when a node has no attachmentId', async () => {
    const { attrs, tokenService } = await share({
      type: 'image',
      attrs: { src: `/api/files/${FILE_ID}/cat.png` },
    });

    expect(attrs[0].src).toBe(publicUrl(FILE_ID, 'cat.png'));
    expect(tokenService.generateAttachmentToken).toHaveBeenCalledWith({
      attachmentId: FILE_ID,
      pageId: PAGE_ID,
      workspaceId: WORKSPACE_ID,
    });
  });

  it('leaves urls that are not attachment files alone', async () => {
    const external = `https://cdn.example.com/files/${FILE_ID}/cat.png`;
    const alreadyPublic = `/api/files/public/${FILE_ID}/cat.png?jwt=old`;

    const { attrs, tokenService } = await share(
      { type: 'image', attrs: { src: external } },
      { type: 'image', attrs: { src: alreadyPublic } },
    );

    expect(attrs.map((a: any) => a.src)).toEqual([external, alreadyPublic]);
    expect(tokenService.generateAttachmentToken).not.toHaveBeenCalled();
  });

  it('does not add a second token to a url that is already public', async () => {
    const alreadyPublic = `/api/files/public/${FILE_ID}/cat.png?jwt=old`;

    const { attrs } = await share({
      type: 'image',
      attrs: { attachmentId: FILE_ID, src: alreadyPublic },
    });

    expect(attrs[0].src).toBe(alreadyPublic);
  });
});
