import { Injectable } from '@nestjs/common';
import * as mammoth from 'mammoth';

@Injectable()
export class DocxImportService {
  async convertDocxToHtml(fileBuffer: Buffer): Promise<string> {
    const result = await mammoth.convertToHtml({
      buffer: fileBuffer,
    });

    return result.value;
  }
}
