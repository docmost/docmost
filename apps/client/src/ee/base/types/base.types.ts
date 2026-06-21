import type { ResolvedPage } from "@/ee/base/queries/base-page-resolver-query";

export type UserRef = { id: string; name: string | null; avatarUrl: string | null };
export type RowReferences = {
  users: Record<string, UserRef>;
  pages: Record<string, ResolvedPage>;
};

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
  | 'lastEditedBy'
  | 'formula'
  | 'longText';

export type BaseViewType = 'table' | 'kanban' | 'calendar';

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

export type NumberSeparatorStyle =
  | 'none'
  | 'local'
  | 'comma_period'
  | 'period_comma'
  | 'space_comma'
  | 'space_period';

export type NumberTypeOptions = {
  format?: 'plain' | 'currency' | 'percent' | 'progress';
  separators?: NumberSeparatorStyle;
  precision?: number;
  currencyCode?: string;
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
  defaultValue?: string | string[] | null;
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
  pageId: string;
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
  pageId: string;
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
  | 'all'
  | 'isWithin';

export type DateFilterAnchor =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'oneWeekAgo'
  | 'oneWeekFromNow'
  | 'oneMonthAgo'
  | 'oneMonthFromNow';

export type DateFilterRange =
  | 'pastWeek'
  | 'pastMonth'
  | 'pastYear'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'nextWeek'
  | 'nextMonth'
  | 'nextYear';

export type DateFilterValue =
  | { mode: 'exact'; date: string }
  | { mode: 'relative'; preset: DateFilterAnchor }
  | { mode: 'range'; preset: DateFilterRange };

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

export const NO_VALUE_CHOICE_ID = '__no_value';

export const KANBAN_CARD_DRAG_TYPE = "base-kanban-card";
export const KANBAN_COLUMN_DRAG_TYPE = "base-kanban-column";
export type KanbanColumn = { key: string; name: string; color?: string; isNoValue: boolean };

export type ViewConfig = {
  sorts?: ViewSortConfig[];
  filter?: FilterGroup;
  visiblePropertyIds?: string[];
  hiddenPropertyIds?: string[];
  propertyWidths?: Record<string, number>;
  propertyOrder?: string[];
  // Kanban
  groupByPropertyId?: string;
  hiddenChoiceIds?: string[];
  choiceOrder?: string[];
};

export type ViewConfigPatch = {
  [K in keyof ViewConfig]?: ViewConfig[K] | null;
};

export type IBaseView = {
  id: string;
  pageId: string;
  name: string;
  type: BaseViewType;
  config: ViewConfig;
  position: string;
  workspaceId: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
};

export type IBase = {
  id: string;
  slugId: string;
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
  permissions?: {
    canEdit: boolean;
    hasRestriction: boolean;
  };
  baseSchemaVersion: number;
};

export type CellCoord = {
  rowId: string;
  propertyId: string;
};

export type EditingCell = CellCoord | null;

export type FocusedCell = CellCoord | null;

export type CreateBaseInput = {
  name: string;
  description?: string;
  icon?: string;
  pageId?: string;
  spaceId: string;
};

export type UpdateBaseInput = {
  pageId: string;
  name?: string;
  description?: string;
  icon?: string;
};

export type CreatePropertyInput = {
  pageId: string;
  name: string;
  type: BasePropertyType;
  typeOptions?: TypeOptions;
  requestId?: string;
};

export type UpdatePropertyInput = {
  propertyId: string;
  pageId: string;
  name?: string;
  type?: BasePropertyType;
  typeOptions?: TypeOptions;
  requestId?: string;
};

export type DeletePropertyInput = {
  propertyId: string;
  pageId: string;
  requestId?: string;
};

export type ReorderPropertyInput = {
  propertyId: string;
  pageId: string;
  position: string;
  requestId?: string;
};

export type CreateRowInput = {
  pageId: string;
  cells?: Record<string, unknown>;
  afterRowId?: string;
  position?: string;
  requestId?: string;
};

export type UpdateRowInput = {
  rowId: string;
  pageId: string;
  cells: Record<string, unknown>;
  position?: string;
  requestId?: string;
};

export type DeleteRowInput = {
  rowId: string;
  pageId: string;
  requestId?: string;
};

export type DeleteRowsInput = {
  pageId: string;
  rowIds: string[];
  requestId?: string;
};

export type ReorderRowInput = {
  rowId: string;
  pageId: string;
  position: string;
  requestId?: string;
};

export type CreateViewInput = {
  pageId: string;
  name: string;
  type?: BaseViewType;
  config?: ViewConfig;
};

export type UpdateViewInput = {
  viewId: string;
  pageId: string;
  name?: string;
  type?: BaseViewType;
  config?: ViewConfigPatch;
  position?: string;
};

export type DeleteViewInput = {
  viewId: string;
  pageId: string;
};

export type UpdatePropertyResult = {
  property: IBaseProperty;
  // Non-null when a background type-conversion job was started. Listen for base:schema:bumped to detect completion.
  jobId: string | null;
};

// Local-first per-view draft stored in localStorage (userId, baseId, viewId).
// Absent filter or sorts means "inherit the baseline for that axis".
export type BaseViewDraft = {
  filter?: FilterGroup;
  sorts?: ViewSortConfig[];
  // ISO timestamp written on each put; diagnostic only, not read by logic.
  updatedAt: string;
};

export type {
  FormulaTypeOptions,
  FormulaResultType,
  ErrorCell as FormulaErrorCell,
  ErrorCode as FormulaErrorCode,
} from "@docmost/base-formula/client";
export { isErrorCell as isFormulaErrorCell } from "@docmost/base-formula/client";
