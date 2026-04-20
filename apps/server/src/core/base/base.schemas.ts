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
  PAGE: 'page',
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
  id: z.uuid(),
  name: z.string().min(1),
  color: z.string(),
  category: z.enum(['todo', 'inProgress', 'complete']).optional(),
});

export const selectTypeOptionsSchema = z
  .object({
    choices: z.array(choiceSchema).default([]),
    choiceOrder: z.array(z.uuid()).default([]),
    disableColors: z.boolean().optional(),
    defaultValue: z
      .union([z.uuid(), z.array(z.uuid())])
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
  [BasePropertyType.PAGE]: emptyTypeOptionsSchema,
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
  [BasePropertyType.SELECT]: z.uuid(),
  [BasePropertyType.STATUS]: z.uuid(),
  [BasePropertyType.MULTI_SELECT]: z.array(z.uuid()),
  [BasePropertyType.DATE]: z.string(),
  [BasePropertyType.PERSON]: z.union([z.uuid(), z.array(z.uuid())]),
  [BasePropertyType.FILE]: z.array(z.object({
    id: z.uuid(),
    fileName: z.string(),
    mimeType: z.string().optional(),
    fileSize: z.number().optional(),
    filePath: z.string().optional(),
  })),
  [BasePropertyType.PAGE]: z.uuid(),
  [BasePropertyType.CHECKBOX]: z.boolean(),
  [BasePropertyType.URL]: z.url(),
  [BasePropertyType.EMAIL]: z.email(),
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

/*
 * Resolution context for conversions where the source type stores IDs
 * (select / multiSelect: choice uuid; person: user uuid; file: attachment
 * uuid). Callers must always supply this — the only invoker is the
 * `BASE_TYPE_CONVERSION` BullMQ worker, which builds the context per
 * chunk of rows (see `tasks/base-type-conversion.task.ts`).
 */
export type CellConversionContext = {
  fromTypeOptions?: unknown;
  userNames?: Map<string, string>;
  attachmentNames?: Map<string, string>;
  pageTitles?: Map<string, string>;
};

function resolveChoiceName(
  typeOptions: unknown,
  id: unknown,
): string | undefined {
  if (!typeOptions || typeof typeOptions !== 'object') return undefined;
  const choices = (typeOptions as any).choices;
  if (!Array.isArray(choices)) return undefined;
  const match = choices.find((c: any) => c?.id === String(id));
  return typeof match?.name === 'string' ? match.name : undefined;
}

export function attemptCellConversion(
  fromType: BasePropertyTypeValue,
  toType: BasePropertyTypeValue,
  value: unknown,
  ctx: CellConversionContext,
): { converted: boolean; value: unknown } {
  if (value === null || value === undefined) {
    return { converted: true, value: null };
  }

  // Resolve IDs to display strings before any direct parse. `select → text`
  // and `multiSelect → text` would otherwise short-circuit on z.string()
  // parsing the UUID itself and return the raw UUID instead of the name.
  if (toType === BasePropertyType.TEXT) {
    if (
      fromType === BasePropertyType.SELECT ||
      fromType === BasePropertyType.STATUS
    ) {
      const name = resolveChoiceName(ctx.fromTypeOptions, value);
      return { converted: true, value: name ?? '' };
    }
    if (fromType === BasePropertyType.MULTI_SELECT && Array.isArray(value)) {
      const parts = value
        .map((v) => resolveChoiceName(ctx.fromTypeOptions, v))
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      return { converted: true, value: parts.join(', ') };
    }
    if (fromType === BasePropertyType.PERSON && ctx.userNames) {
      const ids = Array.isArray(value) ? value : [value];
      const parts = ids
        .map((v) => ctx.userNames!.get(String(v)))
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      return { converted: true, value: parts.join(', ') };
    }
    if (fromType === BasePropertyType.FILE && Array.isArray(value)) {
      const parts = value
        .map((f: any) => {
          if (f && typeof f === 'object') {
            if (typeof f.fileName === 'string') return f.fileName;
            if (typeof f.id === 'string' && ctx.attachmentNames) {
              return ctx.attachmentNames.get(f.id);
            }
          }
          if (typeof f === 'string' && ctx.attachmentNames) {
            return ctx.attachmentNames.get(f);
          }
          return undefined;
        })
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      return { converted: true, value: parts.join(', ') };
    }
    if (fromType === BasePropertyType.PAGE && typeof value === 'string') {
      const title = ctx.pageTitles?.get(value);
      return { converted: true, value: title ?? '' };
    }
  }

  // Page cells only accept a page UUID. Free text / other IDs can't be
  // coerced into a valid page reference — drop to null.
  if (toType === BasePropertyType.PAGE && fromType !== BasePropertyType.PAGE) {
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
  propertyId: z.uuid(),
  direction: z.enum(['asc', 'desc']),
});

/*
 * View-stored filter shape matches the engine's predicate tree (see
 * `core/base/engine/schema.zod.ts`). No legacy flat-array / operator-name
 * variants are accepted — stored view configs use `op` (eq / neq / gt /
 * lt / contains / ncontains / ...) and nested and/or groups.
 */
const viewFilterConditionSchema = z.object({
  propertyId: z.uuid(),
  op: z.enum([
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'ncontains',
    'startsWith',
    'endsWith',
    'isEmpty',
    'isNotEmpty',
    'before',
    'after',
    'onOrBefore',
    'onOrAfter',
    'any',
    'none',
    'all',
  ]),
  value: z.unknown().optional(),
});

type ViewFilterCondition = z.infer<typeof viewFilterConditionSchema>;
type ViewFilterGroup = {
  op: 'and' | 'or';
  children: Array<ViewFilterCondition | ViewFilterGroup>;
};

const viewFilterNodeSchema: z.ZodType<ViewFilterCondition | ViewFilterGroup> =
  z.lazy(() => z.union([viewFilterConditionSchema, viewFilterGroupSchema]));

const viewFilterGroupSchema: z.ZodType<ViewFilterGroup> = z.lazy(() =>
  z.object({
    op: z.enum(['and', 'or']),
    children: z.array(viewFilterNodeSchema),
  }),
);

export const viewConfigSchema = z
  .object({
    sorts: z.array(viewSortSchema).optional(),
    filter: viewFilterGroupSchema.optional(),
    visiblePropertyIds: z.array(z.uuid()).optional(),
    hiddenPropertyIds: z.array(z.uuid()).optional(),
    propertyWidths: z.record(z.string(), z.number().positive()).optional(),
    propertyOrder: z.array(z.uuid()).optional(),
  })
  .passthrough();

export type ViewConfig = z.infer<typeof viewConfigSchema>;
