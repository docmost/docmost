import { z } from 'zod';

export const MAX_FILTER_DEPTH = 5;
export const MAX_FILTER_NODES = 50;
export const MAX_SORTS = 5;

const uuid = z.uuid();

export const operatorSchema = z.enum([
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
]);

export type Operator = z.infer<typeof operatorSchema>;

export const conditionSchema = z.object({
  propertyId: uuid,
  op: operatorSchema,
  value: z.unknown().optional(),
});

export type Condition = z.infer<typeof conditionSchema>;

export type FilterNode = Condition | FilterGroup;
export type FilterGroup = {
  op: 'and' | 'or';
  children: FilterNode[];
};

// Recursive Zod schema for grouped filter trees.
export const filterNodeSchema: z.ZodType<FilterNode> = z.lazy(() =>
  z.union([conditionSchema, filterGroupSchema]),
);

export const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
  z.object({
    op: z.enum(['and', 'or']),
    children: z.array(filterNodeSchema),
  }),
);

// Count nodes + max depth to prevent pathological trees from reaching SQL.
export function validateFilterTree(node: FilterNode): void {
  let nodes = 0;
  const walk = (n: FilterNode, depth: number) => {
    if (depth > MAX_FILTER_DEPTH) {
      throw new Error(`Filter tree exceeds max depth ${MAX_FILTER_DEPTH}`);
    }
    nodes += 1;
    if (nodes > MAX_FILTER_NODES) {
      throw new Error(`Filter tree exceeds max node count ${MAX_FILTER_NODES}`);
    }
    if ('children' in n) {
      for (const c of n.children) walk(c, depth + 1);
    }
  };
  walk(node, 0);
}

export const sortSpecSchema = z.object({
  propertyId: uuid,
  direction: z.enum(['asc', 'desc']),
});

export type SortSpec = z.infer<typeof sortSpecSchema>;

export const sortsSchema = z.array(sortSpecSchema).max(MAX_SORTS);

export const searchSchema = z.object({
  query: z.string().min(1).max(500),
  mode: z.enum(['trgm', 'fts']).default('trgm'),
});

export type SearchSpec = z.infer<typeof searchSchema>;

// Top-level request DTO shape. The row controller DTO composes this.
export const listQuerySchema = z.object({
  filter: filterGroupSchema.optional(),
  sorts: sortsSchema.optional(),
  search: searchSchema.optional(),
});

export type ListQuery = z.infer<typeof listQuerySchema>;
