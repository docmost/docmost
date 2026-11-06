import { Logger } from '@nestjs/common';
import { PageService } from './page.service';

const PAGE_ID = '019a1f00-0000-7000-8000-000000000011';

function makeService(handleYjsEvent: jest.Mock) {
  return new PageService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { handleYjsEvent } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

describe('PageService getLiveContent', () => {
  it('returns the live document of an open page', async () => {
    const live = { type: 'doc', content: [] };
    const handleYjsEvent = jest.fn(async () => live);

    const content = await makeService(handleYjsEvent).getLiveContent(PAGE_ID);

    expect(content).toBe(live);
    expect(handleYjsEvent).toHaveBeenCalledWith(
      'getPageContent',
      `page.${PAGE_ID}`,
      undefined,
      true,
    );
  });

  it('returns null when the live document cannot be reached', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const handleYjsEvent = jest.fn(async () => {
      throw new Error('TIMEOUT');
    });

    try {
      const content = await makeService(handleYjsEvent).getLiveContent(PAGE_ID);

      expect(content).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('TIMEOUT'));
    } finally {
      warn.mockRestore();
    }
  });
});
