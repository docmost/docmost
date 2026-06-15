import type React from 'react';
import type { IconLetterT } from '@tabler/icons-react';
import type {
  BasePropertyType,
  IBaseProperty,
  IBaseRow,
  TypeOptions,
} from '@/ee/base/types/base.types';

export type CellComponentProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  /** When true the cell must not write; reveal content read-only. */
  readOnly?: boolean;
  onCommit: (value: unknown) => void;
  onValueChange: (value: unknown) => void;
  onCancel: () => void;
  onTabNavigate?: (shiftKey: boolean) => void;
};

export type FilterInputKind =
  | 'choices'
  | 'number'
  | 'boolean'
  | 'text'
  | 'person'
  | 'date';

export type ClientPropertyTypeDescriptor = {
  type: BasePropertyType;
  cellComponent: React.ComponentType<CellComponentProps>;
  icon: typeof IconLetterT;
  labelKey: string;
  filterOperators: string[];
  filterInput: FilterInputKind;
  isSystem: boolean;
  hasOptions: boolean;
  systemAccessor?: (row: IBaseRow) => unknown;
  defaultTypeOptions?: () => TypeOptions;
};
