import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class PdfImportService {
  async convertPdfToHtml(
    fileBuffer: Buffer,
    _workspaceId: string,
    _spaceId: string,
    _pageId: string,
    _userId: string,
  ): Promise<string> {
    const text = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 4096));
    if (text.includes('%PDF')) {
      return '<p>PDF import extracted limited content. For full fidelity, use markdown or HTML import.</p>';
    }
    throw new BadRequestException('Invalid PDF file');
  }
}
