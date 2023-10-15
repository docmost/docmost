import { Page } from '../entities/page.entity';

export class PageWithOrderingDto extends Page {
  childrenIds?: string[];
}
