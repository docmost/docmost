import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class ConfluenceImportService {
  async processConfluenceImport(): Promise<void> {
    throw new BadRequestException(
      'Confluence import is not implemented in the local EE shim',
    );
  }
}
