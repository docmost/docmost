import { ImportService } from './import.service';
import { StorageService } from '../../storage/storage.service';
import { getAttachmentFolderPath } from '../../../core/attachment/attachment.utils';
import { AttachmentType } from '../../../core/attachment/attachment.constants';
import { QueueName } from '../../queue/constants/queue.constants';

jest.mock('@docmost/pdf-inspector', () => ({
  processPdfWithImages: jest.fn(),
}));

jest.mock('@docmost/editor-ext', () => ({
  markdownToHtml: jest.fn(),
}));

jest.mock('../../../collaboration/collaboration.util', () => ({
  htmlToJson: jest.fn(),
  jsonToText: jest.fn(),
  tiptapExtensions: [],
}));

jest.mock('../utils/import-formatter', () => ({
  normalizeImportHtml: jest.fn(),
}));

jest.mock('cheerio', () => ({
  load: jest.fn(() => ({
    html: jest.fn().mockReturnValue(''),
    root: jest.fn(),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { processPdfWithImages } = require('@docmost/pdf-inspector');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { markdownToHtml } = require('@docmost/editor-ext');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { htmlToJson } = require('../../../collaboration/collaboration.util');

describe('ImportService - processPdf', () => {
  let service: ImportService;
  let storageService: { upload: jest.Mock };
  let db: { insertInto: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    storageService = { upload: jest.fn().mockResolvedValue(undefined) };

    const executeMock = jest.fn().mockResolvedValue(undefined);
    const valuesMock = jest.fn().mockReturnValue({ execute: executeMock });
    db = {
      insertInto: jest.fn().mockReturnValue({ values: valuesMock }),
    };

    // Instantiate directly, bypassing Nest DI
    service = new ImportService(
      {} as any, // pageRepo - not used by processPdf
      storageService as any,
      db as any,
      { add: jest.fn() } as any, // fileTaskQueue
      {} as any, // moduleRef
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('converts text-based PDF markdown to prosemirror JSON', async () => {
    processPdfWithImages.mockReturnValue({
      markdown: '# Test Title\n\nSome body text here.',
      images: [],
      pageCount: 1,
      pdfType: 'TextBased',
    });

    markdownToHtml.mockReturnValue(
      '<h1>Test Title</h1><p>Some body text here.</p>',
    );

    htmlToJson.mockReturnValue({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Test Title' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Some body text here.' }],
        },
      ],
    });

    const result = await service.processPdf(
      Buffer.from('fake-pdf'),
      'ws-1',
      'space-1',
      'page-1',
      'user-1',
    );

    expect(result).toBeDefined();
    expect(result.type).toBe('doc');
    expect(result.content[0].type).toBe('heading');
    expect(result.content[1].type).toBe('paragraph');
    expect(processPdfWithImages).toHaveBeenCalledWith(Buffer.from('fake-pdf'));
  });

  it('returns empty paragraph for scanned PDFs with no markdown', async () => {
    processPdfWithImages.mockReturnValue({
      markdown: null,
      images: [],
      pageCount: 5,
      pdfType: 'Scanned',
    });

    htmlToJson.mockReturnValue({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    });

    const result = await service.processPdf(
      Buffer.from('fake-pdf'),
      'ws-1',
      'space-1',
      'page-1',
      'user-1',
    );

    expect(result).toBeDefined();
    expect(result.content[0].type).toBe('paragraph');
  });

  it('uploads images and replaces pdf-image:// placeholders', async () => {
    const fakeImageBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    processPdfWithImages.mockReturnValue({
      markdown: '# Doc\n\n![image](pdf-image://0)\n\nText after.',
      images: [
        {
          data: fakeImageBuffer,
          format: 'Jpeg',
          width: 800,
          height: 600,
          page: 1,
        },
      ],
      pageCount: 1,
      pdfType: 'TextBased',
    });

    let capturedMarkdown: string;
    markdownToHtml.mockImplementation((md: string) => {
      capturedMarkdown = md;
      return '<h1>Doc</h1><img src="/api/files/ID/file.jpg"><p>Text after.</p>';
    });

    htmlToJson.mockReturnValue({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 } },
        { type: 'image' },
        { type: 'paragraph' },
      ],
    });

    await service.processPdf(
      Buffer.from('fake-pdf'),
      'ws-1',
      'space-1',
      'page-1',
      'user-1',
    );

    expect(storageService.upload).toHaveBeenCalledTimes(1);
    const expectedPath = `${getAttachmentFolderPath(AttachmentType.File, 'ws-1')}/`;
    expect(storageService.upload.mock.calls[0][0]).toContain(expectedPath);
    expect(storageService.upload.mock.calls[0][1]).toBe(fakeImageBuffer);

    expect(db.insertInto).toHaveBeenCalledWith('attachments');

    expect(capturedMarkdown).not.toContain('pdf-image://0');
    expect(capturedMarkdown).toContain('<img');
    expect(capturedMarkdown).toContain('/api/files/');
  });
});