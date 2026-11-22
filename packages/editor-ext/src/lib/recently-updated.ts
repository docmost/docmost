import { mergeAttributes, Node } from '@tiptap/core';
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
  excludeSpaces: string[];
  spaceMatch: 'any' | 'all';
  labels: string[];
  excludeLabels: string[];
  match: 'any' | 'all';
}

export interface RecentlyUpdatedAttributes extends RecentlyUpdatedFilters {
  limit: number;
  hideHeading: boolean;
}

export function recentlyUpdatedFilterValueWithinLimit(value: string): boolean {
  return isLength(value, { max: RECENTLY_UPDATED_FILTER_LIMITS.maxLength });
}

export function recentlyUpdatedFiltersWithinLimits({
  spaces,
  excludeSpaces,
  labels,
  excludeLabels,
}: RecentlyUpdatedFilters): boolean {
  const { maxValues } = RECENTLY_UPDATED_FILTER_LIMITS;
  return [spaces, excludeSpaces, labels, excludeLabels].every(
    (values) =>
      values.length <= maxValues &&
      values.every(recentlyUpdatedFilterValueWithinLimit),
  );
}

function isFilterList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((token) => typeof token === 'string' && token.trim().length > 0)
  );
}

type FilterInput = Partial<Record<keyof RecentlyUpdatedFilters, unknown>>;

export function normalizeRecentlyUpdatedFilters({
  spaces = [],
  excludeSpaces = [],
  spaceMatch = 'any',
  labels = [],
  excludeLabels = [],
  match = 'any',
}: FilterInput): RecentlyUpdatedFilters {
  if (
    !isFilterList(spaces) ||
    !isFilterList(excludeSpaces) ||
    (spaceMatch !== 'any' && spaceMatch !== 'all') ||
    !isFilterList(labels) ||
    !isFilterList(excludeLabels) ||
    (match !== 'any' && match !== 'all')
  ) {
    // An unresolved space keeps a malformed restriction from exposing other pages.
    return {
      spaces: ['?'],
      excludeSpaces: [],
      spaceMatch: 'any',
      labels: [],
      excludeLabels: [],
      match: 'any',
    };
  }
  return { spaces, excludeSpaces, spaceMatch, labels, excludeLabels, match };
}

function readFilterList(element: HTMLElement, attribute: string): unknown {
  const raw = element.getAttribute(attribute);
  if (raw === null) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const filterListAttribute = {
  default: [],
  rendered: false,
  parseHTML: () => null,
  validate: (value: unknown) => {
    if (!isFilterList(value))
      throw new RangeError('Invalid recently updated filter');
  },
};

const matchAttribute = {
  default: 'any',
  rendered: false,
  parseHTML: () => null,
  validate: (value: unknown) => {
    if (value !== 'any' && value !== 'all') {
      throw new RangeError('Invalid recently updated match');
    }
  },
};

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
      spaces: filterListAttribute,
      excludeSpaces: filterListAttribute,
      spaceMatch: matchAttribute,
      labels: filterListAttribute,
      excludeLabels: filterListAttribute,
      match: matchAttribute,
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
    return [
      {
        tag: 'div[data-type="recently-updated"]',
        getAttrs: (element: HTMLElement) =>
          normalizeRecentlyUpdatedFilters({
            spaces: readFilterList(element, 'data-spaces'),
            excludeSpaces: readFilterList(element, 'data-exclude-spaces'),
            spaceMatch: element.getAttribute('data-space-match') ?? undefined,
            labels: readFilterList(element, 'data-labels'),
            excludeLabels: readFilterList(element, 'data-exclude-labels'),
            match: element.getAttribute('data-match') ?? undefined,
          }),
      },
    ];
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
    const { spaces, excludeSpaces, spaceMatch, labels, excludeLabels, match } =
      normalizeRecentlyUpdatedFilters(node.attrs);
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'recently-updated',
        'data-match': match,
        'data-space-match': spaceMatch,
        ...(excludeSpaces.length && {
          'data-exclude-spaces': JSON.stringify(excludeSpaces),
        }),
        ...(spaces.length && { 'data-spaces': JSON.stringify(spaces) }),
        ...(labels.length && { 'data-labels': JSON.stringify(labels) }),
        ...(excludeLabels.length && {
          'data-exclude-labels': JSON.stringify(excludeLabels),
        }),
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
        ({
          excludeSpaces,
          spaces = excludeSpaces?.length ? [] : ['@self'],
          ...attributes
        } = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              limit: normalizeRecentlyUpdatedLimit(attributes.limit),
              hideHeading: attributes.hideHeading === true,
              ...structuredClone(
                normalizeRecentlyUpdatedFilters({
                  ...attributes,
                  spaces,
                  excludeSpaces,
                }),
              ),
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
