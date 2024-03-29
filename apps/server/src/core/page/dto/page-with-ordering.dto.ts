import { Page } from '@docmost/db/types/entity.types';

export type PageWithOrderingDto = Page & { childrenIds?: string[] };
