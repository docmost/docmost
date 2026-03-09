import { z } from 'zod';

export const BasePropertyType = {
  TEXT: 'text',
  NUMBER: 'number',
  SELECT: 'select',
  STATUS: 'status',
  MULTI_SELECT: 'multiSelect',
  DATE: 'date',
  PERSON: 'person',
  FILE: 'file',
  CHECKBOX: 'checkbox',
  URL: 'url',
  EMAIL: 'email',
  CREATED_AT: 'createdAt',
  LAST_EDITED_AT: 'lastEditedAt',
  LAST_EDITED_BY: 'lastEditedBy',
} as const;

const SYSTEM_PROPERTY_TYPES: Set<string> = new Set([
  BasePropertyType.CREATED_AT,
  BasePropertyType.LAST_EDITED_AT,
  BasePropertyType.LAST_EDITED_BY,
]);

export function isSystemPropertyType(type: string): boolean {
  return SYSTEM_PROPERTY_TYPES.has(type);
}

export type BasePropertyTypeValue =
  (typeof BasePropertyType)[keyof typeof BasePropertyType];

export const BASE_PROPERTY_TYPES = Object.values(BasePropertyType);

export const choiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  color: z.string(),
  category: z.enum(['todo', 'inProgress', 'complete']).optional(),
});

export const selectTypeOptionsSchema = z
  .object({
    choices: z.array(choiceSchema).default([]),
    choiceOrder: z.array(z.string().uuid()).default([]),
    disableColors: z.boolean().optional(),
    defaultValue: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .nullable()
      .optional(),
  })
  .passthrough();

export const numberTypeOptionsSchema = z
  .object({
    format: z
      .enum(['plain', 'currency', 'percent', 'progress'])
      .optional()
      .default('plain'),
    precision: z.number().int().min(0).max(10).optional(),
    currencySymbol: z.string().max(5).optional(),
    defaultValue: z.number().nullable().optional(),
  })
  .passthrough();

export const dateTypeOptionsSchema = z
  .object({
    dateFormat: z.string().optional(),
    timeFormat: z.enum(['12h', '24h']).optional(),
    includeTime: z.boolean().optional(),
    defaultValue: z.string().nullable().optional(),
  })
  .passthrough();

export const textTypeOptionsSchema = z
  .object({
    richText: z.boolean().optional(),
    defaultValue: z.string().nullable().optional(),
  })
  .passthrough();

export const checkboxTypeOptionsSchema = z
  .object({
    defaultValue: z.boolean().optional(),
  })
  .passthrough();

export const urlTypeOptionsSchema = z
  .object({
    defaultValue: z.string().nullable().optional(),
  })
  .passthrough();

export const emailTypeOptionsSchema = z
  .object({
    defaultValue: z.string().nullable().optional(),
  })
  .passthrough();

export const personTypeOptionsSchema = z
  .object({
    allowMultiple: z.boolean().default(true),
  })
  .passthrough();

export const emptyTypeOptionsSchema = z.object({}).passthrough();

const typeOptionsSchemaMap: Record<BasePropertyTypeValue, z.ZodType> = {
  [BasePropertyType.TEXT]: textTypeOptionsSchema,
  [BasePropertyType.NUMBER]: numberTypeOptionsSchema,
  [BasePropertyType.SELECT]: selectTypeOptionsSchema,
  [BasePropertyType.STATUS]: selectTypeOptionsSchema,
  [BasePropertyType.MULTI_SELECT]: selectTypeOptionsSchema,
  [BasePropertyType.DATE]: dateTypeOptionsSchema,
  [BasePropertyType.PERSON]: personTypeOptionsSchema,
  [BasePropertyType.FILE]: emptyTypeOptionsSchema,
  [BasePropertyType.CHECKBOX]: checkboxTypeOptionsSchema,
  [BasePropertyType.URL]: urlTypeOptionsSchema,
  [BasePropertyType.EMAIL]: emailTypeOptionsSchema,
  [BasePropertyType.CREATED_AT]: emptyTypeOptionsSchema,
  [BasePropertyType.LAST_EDITED_AT]: emptyTypeOptionsSchema,
  [BasePropertyType.LAST_EDITED_BY]: emptyTypeOptionsSchema,
};

export function validateTypeOptions(
  type: BasePropertyTypeValue,
  typeOptions: unknown,
): z.ZodSafeParseResult<unknown> {
  const schema = typeOptionsSchemaMap[type];
  if (!schema) {
    return { success: false, error: new z.ZodError([{ code: 'custom', message: `Unknown property type: ${type}`, path: ['type'] }]) } as z.ZodSafeParseError<unknown>;
  }
  return schema.safeParse(typeOptions ?? {});
}

export function parseTypeOptions(
  type: BasePropertyTypeValue,
  typeOptions: unknown,
): unknown {
  const result = validateTypeOptions(type, typeOptions);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

const cellValueSchemaMap: Partial<Record<BasePropertyTypeValue, z.ZodType>> = {
  [BasePropertyType.TEXT]: z.string(),
  [BasePropertyType.NUMBER]: z.number(),
  [BasePropertyType.SELECT]: z.string().uuid(),
  [BasePropertyType.STATUS]: z.string().uuid(),
  [BasePropertyType.MULTI_SELECT]: z.array(z.string().uuid()),
  [BasePropertyType.DATE]: z.string(),
  [BasePropertyType.PERSON]: z.union([z.string().uuid(), z.array(z.string().uuid())]),
  [BasePropertyType.FILE]: z.array(z.object({
    id: z.string().uuid(),
    fileName: z.string(),
    mimeType: z.string().optional(),
    fileSize: z.number().optional(),
    filePath: z.string().optional(),
  })),
  [BasePropertyType.CHECKBOX]: z.boolean(),
  [BasePropertyType.URL]: z.string().url(),
  [BasePropertyType.EMAIL]: z.string().email(),
};

export function getCellValueSchema(
  type: BasePropertyTypeValue,
): z.ZodType | undefined {
  return cellValueSchemaMap[type];
}

export function validateCellValue(
  type: BasePropertyTypeValue,
  value: unknown,
): z.ZodSafeParseResult<unknown> {
  const schema = cellValueSchemaMap[type];
  if (!schema) {
    return { success: false, error: new z.ZodError([{ code: 'custom', message: `Unknown property type: ${type}`, path: [] }]) } as z.ZodSafeParseError<unknown>;
  }
  return schema.safeParse(value);
}

export function attemptCellConversion(
  fromType: BasePropertyTypeValue,
  toType: BasePropertyTypeValue,
  value: unknown,
): { converted: boolean; value: unknown } {
  if (value === null || value === undefined) {
    return { converted: true, value: null };
  }

  const targetSchema = cellValueSchemaMap[toType];
  if (!targetSchema) {
    return { converted: false, value: null };
  }

  const directResult = targetSchema.safeParse(value);
  if (directResult.success) {
    return { converted: true, value: directResult.data };
  }

  if (toType === BasePropertyType.TEXT) {
    return { converted: true, value: String(value) };
  }

  if (toType === BasePropertyType.NUMBER && typeof value === 'string') {
    const num = Number(value);
    if (!isNaN(num)) {
      return { converted: true, value: num };
    }
  }

  if (toType === BasePropertyType.CHECKBOX) {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return { converted: true, value: true };
      }
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === '') {
        return { converted: true, value: false };
      }
    }
    if (typeof value === 'number') {
      return { converted: true, value: value !== 0 };
    }
  }

  if (
    toType === BasePropertyType.MULTI_SELECT &&
    fromType === BasePropertyType.SELECT &&
    typeof value === 'string'
  ) {
    return { converted: true, value: [value] };
  }

  if (
    toType === BasePropertyType.SELECT &&
    fromType === BasePropertyType.MULTI_SELECT &&
    Array.isArray(value) &&
    value.length > 0
  ) {
    return { converted: true, value: value[0] };
  }

  return { converted: false, value: null };
}

export const viewSortSchema = z.object({
  propertyId: z.string().uuid(),
  direction: z.enum(['asc', 'desc']),
});

export const viewFilterSchema = z.object({
  propertyId: z.string().uuid(),
  operator: z.enum([
    'equals',
    'notEquals',
    'contains',
    'notContains',
    'isEmpty',
    'isNotEmpty',
    'greaterThan',
    'lessThan',
    'before',
    'after',
  ]),
  value: z.unknown().optional(),
});

export const viewConfigSchema = z
  .object({
    sorts: z.array(viewSortSchema).optional(),
    filters: z.array(viewFilterSchema).optional(),
    visiblePropertyIds: z.array(z.string().uuid()).optional(),
    hiddenPropertyIds: z.array(z.string().uuid()).optional(),
    propertyWidths: z.record(z.string(), z.number().positive()).optional(),
    propertyOrder: z.array(z.string().uuid()).optional(),
  })
  .passthrough();

export type ViewConfig = z.infer<typeof viewConfigSchema>;
