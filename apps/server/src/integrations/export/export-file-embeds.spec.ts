import { ExportFormat } from './dto/export-dto';
import { ExportService } from './export.service';
import { updateAttachmentUrlsToLocalPaths } from './utils';

jest.mock('@sindresorhus/slugify', () => ({
  __esModule: true,
  default: (text: string) => text.toLowerCase().replace(/\s+/g, '-'),
}));

const PDF_ID = '019a1f00-0000-7000-8000-0000000000a1';
const AUDIO_ID = '019a1f00-0000-7000-8000-0000000000a2';

const service = new ExportService(
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
  {} as any,
);

function pageWithEmbeds(pdfSrc: string, audioSrc: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'pdf',
        attrs: { src: pdfSrc, name: 'Q3_report.pdf', attachmentId: PDF_ID },
      },
      { type: 'audio', attrs: { src: audioSrc, attachmentId: AUDIO_ID } },
    ],
  };
}

const appPage = pageWithEmbeds(
  `/api/files/${PDF_ID}/Q3_report.pdf`,
  `/api/files/${AUDIO_ID}/standup.mp3`,
);

function exportPage(format: ExportFormat, content: any) {
  return service.exportPage(format, { title: '', content } as any);
}

describe('ExportService pdf and audio embeds', () => {
  describe('in a zip export with attachments', () => {
    const zipPage = updateAttachmentUrlsToLocalPaths(appPage);

    it('links the pdf file in markdown', async () => {
      const markdown = await exportPage(ExportFormat.Markdown, zipPage);

      expect(markdown).toContain(
        `[Q3_report.pdf](files/${PDF_ID}/Q3_report.pdf)`,
      );
      expect(markdown).not.toContain('[]()');
    });

    it('links the audio file in markdown', async () => {
      const markdown = await exportPage(ExportFormat.Markdown, zipPage);

      expect(markdown).toContain(
        `[standup.mp3](files/${AUDIO_ID}/standup.mp3)`,
      );
    });

    it('keeps the file paths in html', async () => {
      const html = await exportPage(ExportFormat.HTML, zipPage);

      expect(html).toContain(`<iframe src="files/${PDF_ID}/Q3_report.pdf"`);
      expect(html).toContain(`<source src="files/${AUDIO_ID}/standup.mp3"`);
    });
  });

  it('links pdf and audio files in a single page markdown export', async () => {
    const markdown = await exportPage(ExportFormat.Markdown, appPage);

    expect(markdown).toContain(
      `[Q3_report.pdf](/api/files/${PDF_ID}/Q3_report.pdf)`,
    );
    expect(markdown).toContain(
      `[standup.mp3](/api/files/${AUDIO_ID}/standup.mp3)`,
    );
  });

  it('names an unnamed pdf after its file, without the query string', async () => {
    const markdown = await exportPage(ExportFormat.Markdown, {
      type: 'doc',
      content: [
        {
          type: 'pdf',
          attrs: {
            src: `/api/files/${PDF_ID}/Q3_report.pdf?jwt=abc.def`,
            attachmentId: PDF_ID,
          },
        },
      ],
    });

    expect(markdown).toContain(
      `[Q3_report.pdf](/api/files/${PDF_ID}/Q3_report.pdf?jwt=abc.def)`,
    );
  });

  it('still drops sources that are not Docmost files', async () => {
    const page = pageWithEmbeds(
      'https://example.com/files/report.pdf',
      `files/not-an-attachment/standup.mp3`,
    );

    const html = await exportPage(ExportFormat.HTML, page);
    const markdown = await exportPage(ExportFormat.Markdown, page);

    expect(html).not.toContain('example.com');
    expect(html).not.toContain('not-an-attachment');
    expect(markdown.trim()).toBe('');
  });

  it('drops a relative path that leaves the attachment folder', async () => {
    const page = pageWithEmbeds(
      `files/${PDF_ID}/../../api/report.pdf`,
      `files/${AUDIO_ID}/clips/standup.mp3`,
    );

    const html = await exportPage(ExportFormat.HTML, page);

    expect(html).not.toContain('api/report.pdf');
    expect(html).not.toContain('clips/standup.mp3');
  });
});
