export type BasePropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'status'
  | 'multiSelect'
  | 'date'
  | 'person'
  | 'file'
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

export type TypeOptions =
  | SelectTypeOptions
  | NumberTypeOptions
  | DateTypeOptions
  | TextTypeOptions
  | CheckboxTypeOptions
  | UrlTypeOptions
  | EmailTypeOptions
  | Record<string, unknown>;

export type IBaseProperty = {
  id: string;
  baseId: string;
  name: string;
  type: BasePropertyType;
  position: string;
  typeOptions: TypeOptions;
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

export type ViewFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'greaterThan'
  | 'lessThan'
  | 'before'
  | 'after';

export type ViewFilterConfig = {
  propertyId: string;
  operator: ViewFilterOperator;
  value?: unknown;
};

export type ViewConfig = {
  sorts?: ViewSortConfig[];
  filters?: ViewFilterConfig[];
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
};

export type UpdatePropertyInput = {
  propertyId: string;
  baseId: string;
  name?: string;
  type?: BasePropertyType;
  typeOptions?: TypeOptions;
};

export type DeletePropertyInput = {
  propertyId: string;
  baseId: string;
};

export type ReorderPropertyInput = {
  propertyId: string;
  baseId: string;
  position: string;
};

export type CreateRowInput = {
  baseId: string;
  cells?: Record<string, unknown>;
  afterRowId?: string;
};

export type UpdateRowInput = {
  rowId: string;
  baseId: string;
  cells: Record<string, unknown>;
};

export type DeleteRowInput = {
  rowId: string;
  baseId: string;
};

export type ReorderRowInput = {
  rowId: string;
  baseId: string;
  position: string;
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

export type ConversionSummary = {
  converted: number;
  cleared: number;
  total: number;
};

export type UpdatePropertyResult = {
  property: IBaseProperty;
  conversionSummary: ConversionSummary | null;
};
