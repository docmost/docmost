import { UpdatablePage } from '@docmost/db/types/entity.types';

export type CoverFields = Pick<
  UpdatablePage,
  'coverPhoto' | 'coverPosition' | 'coverAttribution'
>;
