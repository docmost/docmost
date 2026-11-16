export const SPACE_LIST_STATUSES = ['active', 'archived', 'all'] as const;

export type SpaceListStatus = (typeof SPACE_LIST_STATUSES)[number];
