import { Space } from '@docmost/db/types/entity.types';

export class BreadcrumbItemDto {
  id: string;
  slugId: string;
  title: string;
  icon: string;
}

export class SearchResponseDto {
  id: string;
  title: string;
  icon: string;
  parentPageId: string;
  creatorId: string;
  rank: number;
  highlight: string;
  createdAt: Date;
  updatedAt: Date;
  space: Partial<Space>;
  breadcrumbs?: BreadcrumbItemDto[];
}
