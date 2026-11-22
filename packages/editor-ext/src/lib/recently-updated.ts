import { mergeAttributes, Node, type Attribute } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import isLength from 'validator/lib/isLength';

export const DEFAULT_RECENTLY_UPDATED_LIMIT = 15;
export const MAX_RECENTLY_UPDATED_LIMIT = 200;
export const RECENTLY_UPDATED_FILTER_LIMITS = {
  maxValues: 100,
  maxLength: 256,
} as const;

export function normalizeRecentlyUpdatedLimit(value: unknown): number {
  const limit =
    typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof limit !== 'number' || !Number.isInteger(limit)) {
    return DEFAULT_RECENTLY_UPDATED_LIMIT;
  }
  return Math.min(MAX_RECENTLY_UPDATED_LIMIT, Math.max(1, limit));
}

export interface RecentlyUpdatedFilters {
  spaces: string[];
  labels: string[];
}

export interface RecentlyUpdatedAttributes extends RecentlyUpdatedFilters {
  limit: number;
  hideHeading: boolean;
}

export function recentlyUpdatedFiltersWithinLimits({
  spaces,
  labels,
}: RecentlyUpdatedFilters): boolean {
  const { maxValues, maxLength } = RECENTLY_UPDATED_FILTER_LIMITS;
  return [spaces, labels].every(
    (values) =>
      values.length <= maxValues &&
      values.every((value) => isLength(value, { max: maxLength })),
  );
}

function isFilterList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((token) => typeof token === 'string' && token.trim().length > 0)
  );
}

export function normalizeRecentlyUpdatedFilterList(value: unknown): string[] {
  if (value === undefined) return [];
  return isFilterList(value) ? [...value] : ['?'];
}

// Escape a leading operator when a label name is stored as a filter value.
const LABEL_OPERATOR = /^[+?\\-]/;

export function encodeRecentlyUpdatedLabel(name: string): string {
  return LABEL_OPERATOR.test(name) ? '\\' + name : name;
}

export function decodeRecentlyUpdatedLabel(value: string): string {
  if (value.startsWith('\\') && LABEL_OPERATOR.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}

function filterAttribute(name: keyof RecentlyUpdatedFilters): Attribute {
  const attribute = `data-${name}`;
  return {
    default: [],
    validate: (value: unknown) => {
      if (!isFilterList(value)) {
        throw new RangeError(`Invalid recently updated ${name}`);
      }
    },
    parseHTML: (element) => {
      const raw = element.getAttribute(attribute);
      if (raw === null) return [];
      try {
        return normalizeRecentlyUpdatedFilterList(JSON.parse(raw));
      } catch {
        // A malformed filter must still restrict the feed.
        return ['?'];
      }
    },
    renderHTML: (attributes) => {
      const filters = normalizeRecentlyUpdatedFilterList(attributes[name]);
      return filters.length ? { [attribute]: JSON.stringify(filters) } : {};
    },
  };
}

interface RecentlyUpdatedOptions {
  HTMLAttributes: Record<string, any>;
  view: ComponentType<ReactNodeViewProps> | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    recentlyUpdated: {
      insertRecentlyUpdated: (
        attributes?: Partial<RecentlyUpdatedAttributes>,
      ) => ReturnType;
    };
  }
}

export const RecentlyUpdated = Node.create<RecentlyUpdatedOptions>({
  name: 'recentlyUpdated',
  group: 'block',
  atom: true,
  draggable: true,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {}, view: null };
  },

  addAttributes() {
    return {
      limit: {
        default: DEFAULT_RECENTLY_UPDATED_LIMIT,
        validate: (value: unknown) => {
          if (value !== normalizeRecentlyUpdatedLimit(value)) {
            throw new RangeError('Invalid recently updated page limit');
          }
        },
        parseHTML: (element) =>
          normalizeRecentlyUpdatedLimit(element.getAttribute('data-limit')),
        renderHTML: ({ limit }) => ({ 'data-limit': limit }),
      },
      spaces: filterAttribute('spaces'),
      labels: filterAttribute('labels'),
      hideHeading: {
        default: false,
        validate: 'boolean',
        parseHTML: (element) =>
          element.getAttribute('data-hide-heading') === 'true',
        renderHTML: ({ hideHeading }) => ({ 'data-hide-heading': hideHeading }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="recently-updated"]' }];
  },

  extendNodeSchema(extension) {
    if (extension.name === 'recentlyUpdated') {
      return {
        leafText: (node: ProseMirrorNode) =>
          node.attrs.hideHeading ? '' : 'Recently updated',
      };
    }
    return {};
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'recently-updated',
      }),
      node.textContent,
    ];
  },

  renderText({ node }) {
    return node.textContent;
  },

  addCommands() {
    return {
      insertRecentlyUpdated:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              limit: normalizeRecentlyUpdatedLimit(attributes?.limit),
              hideHeading: attributes?.hideHeading === true,
              spaces: normalizeRecentlyUpdatedFilterList(attributes?.spaces),
              labels: normalizeRecentlyUpdatedFilterList(attributes?.labels),
            },
          }),
    };
  },

  addNodeView() {
    if (!this.options.view) return null;
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
