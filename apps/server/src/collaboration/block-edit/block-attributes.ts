import { CALLOUT_TYPES } from '@docmost/editor-ext';
import { getSchema } from '@tiptap/core';
import { tiptapExtensions } from '../collaboration.util';

type AttributeValue = string | number | boolean | null;
type AttributeRule =
  | { type: 'string'; enum: readonly string[] }
  | { type: 'string'; format: 'emoji' }
  | { type: 'boolean' }
  | { type: 'integer'; minimum: number; maximum: number }
  | { type: 'number'; exclusiveMinimum: number; maximum: number };

export type WritableAttribute = AttributeRule & { default: AttributeValue };

const align = ['left', 'center', 'right'] as const;
const textAlign = { type: 'string', enum: [...align, 'justify'] } as const;
const rules: Record<string, Record<string, AttributeRule>> = {
  callout: {
    type: { type: 'string', enum: CALLOUT_TYPES },
    icon: { type: 'string', format: 'emoji' },
  },
  paragraph: { textAlign },
  heading: { textAlign, level: { type: 'integer', minimum: 1, maximum: 6 } },
  embed: {
    align: { type: 'string', enum: align },
    widthPercent: { type: 'number', exclusiveMinimum: 0, maximum: 100 },
  },
  taskItem: { checked: { type: 'boolean' } },
  details: { open: { type: 'boolean' } },
};

const schema = getSchema(tiptapExtensions);
const writable = new Map<string, Readonly<Record<string, WritableAttribute>>>(
  Object.entries(rules).map(([nodeType, fields]) => [
    nodeType,
    Object.fromEntries(
      Object.entries(fields).map(([name, rule]) => [
        name,
        { ...rule, default: schema.nodes[nodeType].spec.attrs[name].default },
      ]),
    ),
  ]),
);

export function getWritableAttributes(
  nodeType: string,
): Readonly<Record<string, WritableAttribute>> {
  return writable.get(nodeType) ?? {};
}

function attributeChoices(rule: AttributeRule): string {
  switch (rule.type) {
    case 'string':
      return 'enum' in rule ? rule.enum.join('|') : rule.format;
    case 'boolean':
      return 'boolean';
    case 'integer':
      return `integer ${rule.minimum}..${rule.maximum}`;
    case 'number':
      return `(${rule.exclusiveMinimum},${rule.maximum}]`;
  }
}

export const writableAttributeSummary = [...writable]
  .map(([nodeType, fields]) => {
    const choices = Object.entries(fields).map(
      ([name, rule]) => `${name}=${attributeChoices(rule)}`,
    );
    return `${nodeType}(${choices.join(', ')})`;
  })
  .join(' ');

// Match one emoji sequence, including flags, keycaps and joined emoji.
const emoji = new RegExp(
  '^(?:\\p{RGI_Emoji}|\\p{Extended_Pictographic})$',
  'v',
);

function invalidValue(rule: AttributeRule, value: unknown): string | undefined {
  switch (rule.type) {
    case 'string':
      if ('enum' in rule) {
        if (typeof value !== 'string' || !rule.enum.includes(value))
          return `must be one of ${rule.enum.join(', ')}`;
      } else if (typeof value !== 'string' || !emoji.test(value)) {
        return 'must be one emoji';
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') return 'must be a boolean';
      break;
    case 'integer':
      if (
        typeof value !== 'number' ||
        !Number.isInteger(value) ||
        value < rule.minimum ||
        value > rule.maximum
      )
        return `must be an integer from ${rule.minimum} to ${rule.maximum}`;
      break;
    case 'number':
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value <= rule.exclusiveMinimum ||
        value > rule.maximum
      )
        return `must be a number greater than ${rule.exclusiveMinimum} and at most ${rule.maximum}`;
      break;
  }
}

export function validateBlockAttributes(
  nodeType: string,
  attrs: unknown,
): Record<string, AttributeValue> | string {
  if (
    attrs === null ||
    typeof attrs !== 'object' ||
    (Object.getPrototypeOf(attrs) !== null &&
      Object.getPrototypeOf(attrs) !== Object.prototype)
  )
    return 'attrs must be an object of native attribute names and values.';
  const keys = Object.keys(attrs);
  if (!keys.length) return 'Supply at least one attribute in attrs.';
  if (Reflect.ownKeys(attrs).length !== keys.length)
    return 'attrs must contain only enumerable string keys.';
  const fields = getWritableAttributes(nodeType);
  const values: Record<string, AttributeValue> = {};
  for (const name of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, name))
      return `Attribute "${name}" is not writable on ${nodeType}.`;
    const rule = fields[name];
    const value = attrs[name];
    if (value !== null) {
      const error = invalidValue(rule, value);
      if (error)
        return `${nodeType}.${name} ${error}, or null to restore the default.`;
    }
    values[name] = value === null ? rule.default : value;
  }
  return values;
}
