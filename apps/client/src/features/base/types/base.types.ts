export type BasePropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'status'
  | 'multiSelect'
  | 'date'
  | 'person'
  | 'file'
  | 'page'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'createdAt'
  | 'lastEditedAt'
  | 'lastEditedBy';

export type Choice = {
  id: string;
  name: string;
  color: string;
  category?: 'todo' | 'inProgress' | 'complete';
};

export type SelectTypeOptions = {
  choices: Choice[];
  choiceOrder: string[];
  disableColors?: boolean;
  defaultValue?: string | string[] | null;
};

export type NumberTypeOptions = {
  format?: 'plain' | 'currency' | 'percent' | 'progress';
  precision?: number;
  currencySymbol?: string;
  defaultValue?: number | null;
};

export type DateTypeOptions = {
  dateFormat?: string;
  timeFormat?: '12h' | '24h';
  includeTime?: boolean;
  defaultValue?: string | null;
};

export type TextTypeOptions = {
  richText?: boolean;
  defaultValue?: string | null;
};

export type CheckboxTypeOptions = {
  defaultValue?: boolean;
};

export type UrlTypeOptions = {
  defaultValue?: string | null;
};

export type EmailTypeOptions = {
  defaultValue?: string | null;
};

export type PersonTypeOptions = {
  allowMultiple?: boolean;
};

export type PageTypeOptions = Record<string, never>;

export type TypeOptions =
  | SelectTypeOptions
  | NumberTypeOptions
  | DateTypeOptions
  | TextTypeOptions
  | CheckboxTypeOptions
  | UrlTypeOptions
  | EmailTypeOptions
  | PersonTypeOptions
  | PageTypeOptions
  | Record<string, unknown>;

export type IBaseProperty = {
  id: string;
  baseId: string;
  name: string;
  type: BasePropertyType;
  position: string;
  typeOptions: TypeOptions;
  // Set while a background type-conversion job is rewriting cells. The
  // live `type` stays on the old kind until the job commits, so cells
  // render correctly; the column header shows a "Converting…" badge.
  pendingType?: BasePropertyType | null;
  pendingTypeOptions?: TypeOptions | null;
  isPrimary: boolean;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

export type IBaseRow = {
  id: string;
  baseId: string;
  cells: Record<string, unknown>;
  position: string;
  creatorId: string;
  lastUpdatedById: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

export type ViewSortConfig = {
  propertyId: string;
  direction: 'asc' | 'desc';
};

// Matches the server's engine operator set (core/base/engine/schema.zod.ts).
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'ncontains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter'
  | 'any'
  | 'none'
  | 'all';

export type FilterCondition = {
  propertyId: string;
  op: FilterOperator;
  value?: unknown;
};

export type FilterGroup = {
  op: 'and' | 'or';
  children: Array<FilterCondition | FilterGroup>;
};

export type FilterNode = FilterCondition | FilterGroup;

export type SearchSpec = {
  query: string;
  mode?: 'trgm' | 'fts';
};

export type ViewConfig = {
  sorts?: ViewSortConfig[];
  filter?: FilterGroup;
  visiblePropertyIds?: string[];
  hiddenPropertyIds?: string[];
  propertyWidths?: Record<string, number>;
  propertyOrder?: string[];
};

export type IBaseView = {
  id: string;
  baseId: string;
  name: string;
  type: 'table' | 'kanban' | 'calendar';
  config: ViewConfig;
  workspaceId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
};

export type IBase = {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  pageId?: string;
  spaceId: string;
  workspaceId: string;
  creatorId: string;
  properties: IBaseProperty[];
  views: IBaseView[];
  createdAt: string;
  updatedAt: string;
};

export type EditingCell = {
  rowId: string;
  propertyId: string;
} | null;

export type CreateBaseInput = {
  name: string;
  description?: string;
  icon?: string;
  pageId?: string;
  spaceId: string;
};

export type UpdateBaseInput = {
  baseId: string;
  name?: string;
  description?: string;
  icon?: string;
};

export type CreatePropertyInput = {
  baseId: string;
  name: string;
  type: BasePropertyType;
  typeOptions?: TypeOptions;
  requestId?: string;
};

export type UpdatePropertyInput = {
  propertyId: string;
  baseId: string;
  name?: string;
  typeOptions?: TypeOptions;
  requestId?: string;
};

export type DeletePropertyInput = {
  propertyId: string;
  baseId: string;
  requestId?: string;
};

export type ReorderPropertyInput = {
  propertyId: string;
  baseId: string;
  position: string;
  requestId?: string;
};

export type CreateRowInput = {
  baseId: string;
  cells?: Record<string, unknown>;
  afterRowId?: string;
  requestId?: string;
};

export type UpdateRowInput = {
  rowId: string;
  baseId: string;
  cells: Record<string, unknown>;
  requestId?: string;
};

export type DeleteRowInput = {
  rowId: string;
  baseId: string;
  requestId?: string;
};

export type DeleteRowsInput = {
  baseId: string;
  rowIds: string[];
  requestId?: string;
};

export type ReorderRowInput = {
  rowId: string;
  baseId: string;
  position: string;
  requestId?: string;
};

export type CreateViewInput = {
  baseId: string;
  name: string;
  type?: 'table' | 'kanban' | 'calendar';
  config?: ViewConfig;
};

export type UpdateViewInput = {
  viewId: string;
  baseId: string;
  name?: string;
  type?: 'table' | 'kanban' | 'calendar';
  config?: ViewConfig;
};

export type DeleteViewInput = {
  viewId: string;
  baseId: string;
};

export type UpdatePropertyResult = {
  property: IBaseProperty;
  // Non-null when the property change kicked off a BullMQ type-conversion
  // job (select/multiSelect/person/file → anything, or any → system type).
  // Client can listen for `base:schema:bumped` on the base room to know
  // when the job finished migrating cells.
  jobId: string | null;
};

// Local-first draft of filter / sort tweaks for a single view, stored in
// localStorage scoped to (userId, baseId, viewId). An absent `filter` or
// `sorts` field means "inherit the baseline for that axis". See
// `.claude/superpowers/specs/2026-04-20-base-view-draft-design.md`.
export type BaseViewDraft = {
  filter?: FilterGroup;
  sorts?: ViewSortConfig[];
  // ISO timestamp written on each put; diagnostic only, not read by logic.
  updatedAt: string;
};
