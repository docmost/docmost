import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class PdfExportService {
  async generateAndStorePdf(_fileTaskId: string): Promise<void> {
    throw new BadRequestException(
      'PDF export generation is not implemented in the local EE shim',
    );
  }

  async cleanupExpiredExports(): Promise<void> {
    // No-op until the full PDF export pipeline is wired in.
  }
}
