import { Injectable } from '@nestjs/common';
import mammoth from 'mammoth';

@Injectable()
export class DocxImportService {
  async convertDocxToHtml(
    fileBuffer: Buffer,
    _workspaceId: string,
    _spaceId: string,
    _pageId: string,
    _userId: string,
  ): Promise<string> {
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    return result.value;
  }
}
