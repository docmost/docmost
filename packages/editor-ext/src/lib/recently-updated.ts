import { mergeAttributes, Node } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { validate as isUuid } from 'uuid';
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
  scope: 'current' | 'spaces' | 'workspace';
  spaceIds: string[];
  excludeSpaceIds: string[];
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
  spaceIds,
  excludeSpaceIds,
  labels,
  excludeLabels,
}: RecentlyUpdatedFilters): boolean {
  const { maxValues } = RECENTLY_UPDATED_FILTER_LIMITS;
  return [spaceIds, excludeSpaceIds, labels, excludeLabels].every(
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
  scope = 'current',
  spaceIds = [],
  excludeSpaceIds = [],
  labels = [],
  excludeLabels = [],
  match = 'any',
}: FilterInput): RecentlyUpdatedFilters {
  const validSpaces = isFilterList(spaceIds) && spaceIds.every(isUuid);
  const validExclusions =
    isFilterList(excludeSpaceIds) && excludeSpaceIds.every(isUuid);
  const validLabels = isFilterList(labels);
  const validExcludedLabels = isFilterList(excludeLabels);
  const validMatch = match === 'any' || match === 'all';
  const valid =
    (scope === 'current' || scope === 'spaces' || scope === 'workspace') &&
    validSpaces &&
    (scope === 'spaces' || !spaceIds.length) &&
    validExclusions &&
    validLabels &&
    validExcludedLabels &&
    validMatch;
  // An explicit empty set matches no pages when a restriction cannot be read.
  return {
    scope: valid ? scope : 'spaces',
    spaceIds: valid ? [...spaceIds] : [],
    excludeSpaceIds: validExclusions ? [...excludeSpaceIds] : [],
    labels: validLabels ? [...labels] : [],
    excludeLabels: validExcludedLabels ? [...excludeLabels] : [],
    match: validMatch ? match : 'any',
  };
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
      scope: {
        default: 'current',
        rendered: false,
        parseHTML: () => null,
        validate: (value: unknown) => {
          if (
            value !== 'current' &&
            value !== 'spaces' &&
            value !== 'workspace'
          )
            throw new RangeError('Invalid recently updated space scope');
        },
      },
      spaceIds: filterListAttribute,
      excludeSpaceIds: filterListAttribute,
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
            scope: element.getAttribute('data-scope') ?? undefined,
            spaceIds: readFilterList(element, 'data-space-ids'),
            excludeSpaceIds: readFilterList(element, 'data-exclude-space-ids'),
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
    const { scope, spaceIds, excludeSpaceIds, labels, excludeLabels, match } =
      normalizeRecentlyUpdatedFilters(node.attrs);
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'recently-updated',
        'data-match': match,
        'data-scope': scope,
        ...(excludeSpaceIds.length && {
          'data-exclude-space-ids': JSON.stringify(excludeSpaceIds),
        }),
        ...(spaceIds.length && { 'data-space-ids': JSON.stringify(spaceIds) }),
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
        (attributes = {}) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              limit: normalizeRecentlyUpdatedLimit(attributes.limit),
              hideHeading: attributes.hideHeading === true,
              ...normalizeRecentlyUpdatedFilters(attributes),
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
