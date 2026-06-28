import { Injectable, NotFoundException } from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { User } from '@docmost/db/types/entity.types';
import { getProsemirrorContent } from '../../common/helpers/prosemirror/utils';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { jsonToText } from '../../collaboration/collaboration.util';

@Injectable()
export class DocxExportService {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pageAccessService: PageAccessService,
  ) {}

  async exportPageToDocx(pageId: string, user: User): Promise<Buffer> {
    const page = await this.pageRepo.findById(pageId, { includeContent: true });
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }

    await this.pageAccessService.validateCanView(page, user);

    const title = page.title || 'Untitled';
    const bodyText =
      jsonToText(getProsemirrorContent(page.content)) ||
      page.textContent ||
      '';

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun(title)],
            }),
            ...bodyText
              .split(/\n+/)
              .filter(Boolean)
              .map(
                (line) =>
                  new Paragraph({
                    children: [new TextRun(line)],
                  }),
              ),
          ],
        },
      ],
    });

    return Packer.toBuffer(doc);
  }
}
