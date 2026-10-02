// slugify is an ESM-only package that jest does not transform; it is unrelated
// to attachment zipping, so stub it to keep this suite importable.
jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (value: string) => value,
}));

import * as JSZip from 'jszip';
import { ExportService } from './export.service';

/**
 * Regression tests for #1307 (invalid zip archives when exporting a space with
 * attachments). Attachment entries must be written with a relative path; a
 * leading slash produces an absolute zip entry that violates the ZIP spec
 * (APPNOTE 4.4.17) and is rejected by tools such as Windows Explorer. The path
 * must also match the relative "files/..." URLs written into the exported
 * documents so the links resolve after extraction.
 */
describe('ExportService.zipAttachments', () => {
  const attachmentId = '019b9105-ce1a-726b-a09d-eb2fc65f904a';
  // non-ASCII name to also exercise the encoding path from the reporter
  const fileName = '스크린샷_2026-01-06.png';

  const buildDoc = () => ({
    type: 'doc',
    content: [
      {
        type: 'image',
        attrs: {
          attachmentId,
          src: `/api/files/${attachmentId}/${fileName}`,
        },
      },
    ],
  });

  const buildService = () => {
    const storageService = {
      read: jest.fn().mockResolvedValue(Buffer.from('image-bytes')),
    };
    // Only storageService is used by zipAttachments; the rest are irrelevant.
    return new ExportService(
      null as any,
      null as any,
      null as any,
      storageService as any,
      null as any,
      null as any,
    );
  };

  const entryNames = async (zip: JSZip): Promise<string[]> => {
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const reloaded = await JSZip.loadAsync(buffer);
    return Object.keys(reloaded.files).filter((name) => !name.endsWith('/'));
  };

  it('writes attachment entries with a relative path (no leading slash)', async () => {
    const service = buildService();
    const zip = new JSZip();
    const allowed = new Map([
      [
        attachmentId,
        {
          id: attachmentId,
          fileName,
          filePath: `workspace/files/${attachmentId}/${fileName}`,
        },
      ],
    ]);

    await service.zipAttachments(buildDoc(), zip, allowed);

    const names = await entryNames(zip);
    expect(names).toContain(`files/${attachmentId}/${fileName}`);
    // guard against a leading-slash regression on any entry
    expect(names.every((name) => !name.startsWith('/'))).toBe(true);
  });

  it('places attachments relative to the page folder so links resolve', async () => {
    const service = buildService();
    const rootZip = new JSZip();
    const pageFolder = rootZip.folder('Parent Page');
    const allowed = new Map([
      [
        attachmentId,
        {
          id: attachmentId,
          fileName,
          filePath: `workspace/files/${attachmentId}/${fileName}`,
        },
      ],
    ]);

    await service.zipAttachments(buildDoc(), pageFolder as JSZip, allowed);

    const names = await entryNames(rootZip);
    expect(names).toContain(`Parent Page/files/${attachmentId}/${fileName}`);
    expect(names.every((name) => !name.startsWith('/'))).toBe(true);
  });
});
