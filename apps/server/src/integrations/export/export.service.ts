import { Injectable } from '@nestjs/common';
import { jsonToHtml } from '../../collaboration/collaboration.util';
import { turndown } from './turndown-utils';
import { ExportFormat } from './dto/export-dto';
import { Page } from '@docmost/db/types/entity.types';

@Injectable()
export class ExportService {
  async exportPage(format: ExportFormat, page: Page) {
    const pageTitle = page.title || 'Untitled';

    const titleNode = {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: pageTitle }],
    };

    let prosemirrorJson: any = page.content || { type: 'doc', content: [] };

    prosemirrorJson.content.unshift(titleNode);

    const pageHtml = jsonToHtml(prosemirrorJson);

    if (format === ExportFormat.HTML) {
      return `<!DOCTYPE html><html><head><title>${pageTitle}</title></head><body>${pageHtml}</body></html>`;
    }

    if (format === ExportFormat.Markdown) {
      return turndown(pageHtml);
    }

    return;
  }
}
