import type {
  IBaseProperty,
  SelectTypeOptions,
  TypeOptions,
} from "@/ee/base/types/base.types";

export const PAGE_PROPERTY_TYPES = [
  "text",
  "longText",
  "number",
  "status",
  "select",
  "multiSelect",
  "date",
  "checkbox",
  "url",
  "email",
] as const;

export type PagePropertyType = (typeof PAGE_PROPERTY_TYPES)[number];

export type PageProperty = IBaseProperty & {
  type: PagePropertyType;
  scope: "page";
  schemaVersion: number;
  value: unknown;
};

export type PagePropertyDefinition = {
  name: string;
  type: PagePropertyType;
  typeOptions: TypeOptions;
};

export type SavePagePropertyChoices = (
  options: SelectTypeOptions,
  expectedSchemaVersion: number,
) => Promise<PageProperty>;

export type PagePropertyChange =
  | ({ action: "create" } & PagePropertyDefinition)
  | ({
      action: "update";
      propertyId: string;
      expectedSchemaVersion: number;
      timeZone?: string;
    } & Partial<PagePropertyDefinition>)
  | { action: "delete"; propertyId: string }
  | { action: "reorder"; propertyId: string; position: string }
  | { action: "values/update"; values: Record<string, unknown> };
