import {
  IconLetterT,
  IconAlignLeft,
  IconHash,
  IconCircleDot,
  IconProgressCheck,
  IconTags,
  IconCalendar,
  IconUser,
  IconPaperclip,
  IconFileDescription,
  IconCheckbox,
  IconLink,
  IconMail,
  IconClockPlus,
  IconClockEdit,
  IconUserEdit,
  IconMathFunction,
} from "@tabler/icons-react";
import type {
  BasePropertyType,
  TypeOptions,
} from "@/ee/base/types/base.types";
import { CellText } from "@/ee/base/components/cells/cell-text";
import { CellLongText } from "@/ee/base/components/cells/cell-long-text";
import { CellNumber } from "@/ee/base/components/cells/cell-number";
import { CellSelect } from "@/ee/base/components/cells/cell-select";
import { CellStatus } from "@/ee/base/components/cells/cell-status";
import { CellMultiSelect } from "@/ee/base/components/cells/cell-multi-select";
import { CellDate } from "@/ee/base/components/cells/cell-date";
import { CellCheckbox } from "@/ee/base/components/cells/cell-checkbox";
import { CellUrl } from "@/ee/base/components/cells/cell-url";
import { CellEmail } from "@/ee/base/components/cells/cell-email";
import { CellPerson } from "@/ee/base/components/cells/cell-person";
import { CellFile } from "@/ee/base/components/cells/cell-file";
import { CellPage } from "@/ee/base/components/cells/cell-page";
import { CellCreatedAt } from "@/ee/base/components/cells/cell-created-at";
import { CellLastEditedAt } from "@/ee/base/components/cells/cell-last-edited-at";
import { CellLastEditedBy } from "@/ee/base/components/cells/cell-last-edited-by";
import { CellFormula } from "@/ee/base/components/cells/cell-formula";
import { defaultStatusChoices } from "@/ee/base/components/property/choice-editor";
import type { ClientPropertyTypeDescriptor } from "./property-type.descriptor";

export const PROPERTY_TYPE_REGISTRY: Record<
  BasePropertyType,
  ClientPropertyTypeDescriptor
> = {
  text: {
    type: "text",
    cellComponent: CellText,
    icon: IconLetterT,
    labelKey: "Text",
    filterOperators: ["eq", "neq", "contains", "ncontains", "isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: false,
    hasOptions: true,
  },
  longText: {
    type: "longText",
    cellComponent: CellLongText,
    icon: IconAlignLeft,
    labelKey: "Long text",
    filterOperators: ["eq", "neq", "contains", "ncontains", "isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: false,
    hasOptions: true,
  },
  number: {
    type: "number",
    cellComponent: CellNumber,
    icon: IconHash,
    labelKey: "Number",
    filterOperators: ["eq", "neq", "gt", "lt", "isEmpty", "isNotEmpty"],
    filterInput: "number",
    isSystem: false,
    hasOptions: true,
    defaultTypeOptions: () => ({ separators: "local" }),
  },
  select: {
    type: "select",
    cellComponent: CellSelect,
    icon: IconCircleDot,
    labelKey: "Select",
    filterOperators: ["eq", "neq", "any", "none", "isEmpty", "isNotEmpty"],
    filterInput: "choices",
    isSystem: false,
    hasOptions: true,
  },
  status: {
    type: "status",
    cellComponent: CellStatus,
    icon: IconProgressCheck,
    labelKey: "Status",
    filterOperators: ["eq", "neq", "any", "none", "isEmpty", "isNotEmpty"],
    filterInput: "choices",
    isSystem: false,
    hasOptions: true,
    defaultTypeOptions: () => {
      const choices = defaultStatusChoices();
      return {
        choices,
        choiceOrder: choices.map((c) => c.id),
        defaultValue: choices[0].id,
      };
    },
  },
  multiSelect: {
    type: "multiSelect",
    cellComponent: CellMultiSelect,
    icon: IconTags,
    labelKey: "Multi-select",
    filterOperators: ["any", "none", "isEmpty", "isNotEmpty"],
    filterInput: "choices",
    isSystem: false,
    hasOptions: true,
  },
  date: {
    type: "date",
    cellComponent: CellDate,
    icon: IconCalendar,
    labelKey: "Date",
    filterOperators: ["eq", "before", "after", "onOrBefore", "onOrAfter", "isWithin", "isEmpty", "isNotEmpty"],
    filterInput: "date",
    isSystem: false,
    hasOptions: true,
  },
  person: {
    type: "person",
    cellComponent: CellPerson,
    icon: IconUser,
    labelKey: "Person",
    filterOperators: ["eq", "neq", "any", "none", "isEmpty", "isNotEmpty"],
    filterInput: "person",
    isSystem: false,
    hasOptions: true,
  },
  file: {
    type: "file",
    cellComponent: CellFile,
    icon: IconPaperclip,
    labelKey: "File",
    filterOperators: ["isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: false,
    hasOptions: false,
  },
  formula: {
    type: "formula",
    cellComponent: CellFormula,
    icon: IconMathFunction,
    labelKey: "Formula",
    filterOperators: ["eq", "neq", "isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: true,
    hasOptions: false,
  },
  page: {
    type: "page",
    cellComponent: CellPage,
    icon: IconFileDescription,
    labelKey: "Page",
    filterOperators: ["isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: false,
    hasOptions: false,
  },
  checkbox: {
    type: "checkbox",
    cellComponent: CellCheckbox,
    icon: IconCheckbox,
    labelKey: "Checkbox",
    filterOperators: ["eq", "isEmpty", "isNotEmpty"],
    filterInput: "boolean",
    isSystem: false,
    hasOptions: true,
  },
  url: {
    type: "url",
    cellComponent: CellUrl,
    icon: IconLink,
    labelKey: "URL",
    filterOperators: ["eq", "neq", "contains", "ncontains", "isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: false,
    hasOptions: true,
  },
  email: {
    type: "email",
    cellComponent: CellEmail,
    icon: IconMail,
    labelKey: "Email",
    filterOperators: ["eq", "neq", "contains", "ncontains", "isEmpty", "isNotEmpty"],
    filterInput: "text",
    isSystem: false,
    hasOptions: true,
  },
  createdAt: {
    type: "createdAt",
    cellComponent: CellCreatedAt,
    icon: IconClockPlus,
    labelKey: "Created at",
    filterOperators: ["eq", "before", "after", "onOrBefore", "onOrAfter", "isWithin", "isEmpty", "isNotEmpty"],
    filterInput: "date",
    isSystem: true,
    hasOptions: false,
    systemAccessor: (row) => row.createdAt,
  },
  lastEditedAt: {
    type: "lastEditedAt",
    cellComponent: CellLastEditedAt,
    icon: IconClockEdit,
    labelKey: "Last edited at",
    filterOperators: ["eq", "before", "after", "onOrBefore", "onOrAfter", "isWithin", "isEmpty", "isNotEmpty"],
    filterInput: "date",
    isSystem: true,
    hasOptions: false,
    systemAccessor: (row) => row.updatedAt,
  },
  lastEditedBy: {
    type: "lastEditedBy",
    cellComponent: CellLastEditedBy,
    icon: IconUserEdit,
    labelKey: "Last edited by",
    filterOperators: ["eq", "neq", "any", "none", "isEmpty", "isNotEmpty"],
    filterInput: "person",
    isSystem: true,
    hasOptions: false,
    systemAccessor: (row) => row.lastUpdatedById ?? row.creatorId,
  },
};

export function getDescriptor(type: string): ClientPropertyTypeDescriptor | undefined {
  return (PROPERTY_TYPE_REGISTRY as Record<string, ClientPropertyTypeDescriptor>)[type];
}

export const SYSTEM_PROPERTY_TYPES: ReadonlySet<string> = new Set(
  Object.values(PROPERTY_TYPE_REGISTRY).filter((d) => d.isSystem).map((d) => d.type),
);

export function isSystemPropertyType(type: string): boolean {
  return SYSTEM_PROPERTY_TYPES.has(type);
}

export const DEFAULT_FILTER_OPERATORS = ["eq", "neq", "isEmpty", "isNotEmpty"];

export const PROPERTY_PICKER_ORDER: BasePropertyType[] = [
  "text", "longText", "number", "select", "status", "multiSelect", "date",
  "person", "file", "formula", "page", "checkbox", "url", "email",
  "createdAt", "lastEditedAt", "lastEditedBy",
];

export const propertyTypes = PROPERTY_PICKER_ORDER.map((type) => {
  const d = getDescriptor(type)!;
  return { type, icon: d.icon, labelKey: d.labelKey };
});

export function systemAccessorFor(type: string) {
  return getDescriptor(type)?.systemAccessor;
}

export function defaultTypeOptionsFor(type: string): TypeOptions {
  return getDescriptor(type)?.defaultTypeOptions?.() ?? ({} as TypeOptions);
}
