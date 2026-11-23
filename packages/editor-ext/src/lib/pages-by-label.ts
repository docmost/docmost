import { mergeAttributes, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { validate as isUuid } from 'uuid';
import isLength from 'validator/lib/isLength';

export const PAGES_BY_LABEL_DEFAULT_LIMIT = 15;
export const PAGES_BY_LABEL_MAX_LIMIT = 500;
export const PAGES_BY_LABEL_MAX_FILTERS = 100;
export const PAGES_BY_LABEL_MAX_LABEL_LENGTH = 100;
export const PAGES_BY_LABEL_MAX_HEADING_LENGTH = 255;

export interface PagesByLabelAttributes {
  labels: string[];
  match: 'any' | 'all';
  excludeLabels: string[];
  scope: 'current' | 'spaces' | 'workspace';
  spaceIds: string[];
  sortBy: 'title' | 'updatedAt' | 'createdAt';
  sortDirection: 'asc' | 'desc';
  limit: number;
  heading: string;
  showLabels: boolean;
  showSpace: boolean;
  excludeCurrentPage: boolean;
}

const defaults: PagesByLabelAttributes = {
  labels: [],
  match: 'any',
  excludeLabels: [],
  scope: 'current',
  spaceIds: [],
  sortBy: 'title',
  sortDirection: 'asc',
  limit: PAGES_BY_LABEL_DEFAULT_LIMIT,
  heading: '',
  showLabels: false,
  showSpace: false,
  excludeCurrentPage: false,
};

export function pagesByLabelNameWithinLimit(name: string): boolean {
  return isLength(name, { min: 1, max: PAGES_BY_LABEL_MAX_LABEL_LENGTH });
}

function normalizeList(value: unknown, isSpace = false): string[] | null {
  if (!Array.isArray(value) || value.length > PAGES_BY_LABEL_MAX_FILTERS)
    return null;
  const result = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== 'string') return null;
    const item = isSpace ? raw : raw.trim().replace(/\s+/g, '-').toLowerCase();
    if (isSpace ? !isUuid(item) : !pagesByLabelNameWithinLimit(item))
      return null;
    result.add(item);
  }
  return [...result];
}

export function parsePagesByLabelAttributes(
  value: unknown,
): PagesByLabelAttributes | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const attrs = { ...defaults, ...value };
  const labels = normalizeList(attrs.labels);
  const excludeLabels = normalizeList(attrs.excludeLabels);
  const spaceIds = normalizeList(attrs.spaceIds, true);
  // Discard the whole query if an invalid condition would change what it matches.
  if (
    !labels ||
    !excludeLabels ||
    !spaceIds ||
    !['any', 'all'].includes(attrs.match) ||
    !['current', 'spaces', 'workspace'].includes(attrs.scope) ||
    (attrs.scope !== 'spaces' && spaceIds.length > 0) ||
    !['title', 'updatedAt', 'createdAt'].includes(attrs.sortBy) ||
    !['asc', 'desc'].includes(attrs.sortDirection) ||
    !Number.isInteger(attrs.limit) ||
    attrs.limit < 1 ||
    attrs.limit > PAGES_BY_LABEL_MAX_LIMIT ||
    typeof attrs.heading !== 'string' ||
    !isLength(attrs.heading, { max: PAGES_BY_LABEL_MAX_HEADING_LENGTH }) ||
    [attrs.showLabels, attrs.showSpace, attrs.excludeCurrentPage].some(
      (flag) => typeof flag !== 'boolean',
    )
  )
    return null;
  return {
    labels,
    match: attrs.match,
    excludeLabels,
    scope: attrs.scope,
    spaceIds,
    sortBy: attrs.sortBy,
    sortDirection: attrs.sortDirection,
    limit: attrs.limit,
    heading: attrs.heading,
    showLabels: attrs.showLabels,
    showSpace: attrs.showSpace,
    excludeCurrentPage: attrs.excludeCurrentPage,
  };
}

export function normalizePagesByLabelAttributes(
  value: unknown,
): PagesByLabelAttributes {
  return parsePagesByLabelAttributes(value) ?? defaults;
}

type PagesByLabelOptions = {
  defaultHeading: () => string;
  view: ComponentType<ReactNodeViewProps> | null;
};

export const pagesByLabelSettingsKey = new PluginKey<number | null>(
  'pagesByLabelSettings',
);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagesByLabel: {
      insertPagesByLabel: (
        attributes?: Partial<PagesByLabelAttributes>,
      ) => ReturnType;
    };
  }
}

export const PagesByLabel = Node.create<PagesByLabelOptions>({
  name: 'pagesByLabel',
  group: 'block',
  atom: true,
  draggable: true,
  isolating: true,

  addOptions() {
    return { view: null, defaultHeading: () => 'Pages by label' };
  },

  addAttributes() {
    return Object.fromEntries(
      Object.entries(defaults).map(([name, value]) => [
        name,
        { default: value, rendered: false, parseHTML: () => null },
      ]),
    );
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="pages-by-label"]',
        getAttrs: (element: HTMLElement) => {
          try {
            const config = JSON.parse(
              element.getAttribute('data-config') ?? '{}',
            );
            if (
              Object.keys(config).some((key) => !Object.hasOwn(defaults, key))
            )
              return defaults;
            return normalizePagesByLabelAttributes(config);
          } catch {
            return defaults;
          }
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = normalizePagesByLabelAttributes(node.attrs);
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'pages-by-label',
        'data-config': JSON.stringify(attrs),
      }),
      attrs.heading || 'Pages by label',
    ];
  },

  renderText({ node }) {
    return (
      normalizePagesByLabelAttributes(node.attrs).heading || 'Pages by label'
    );
  },

  addCommands() {
    return {
      insertPagesByLabel:
        (attributes) =>
        ({ commands, dispatch, tr }) => {
          const node = this.type.create(
            normalizePagesByLabelAttributes({
              ...attributes,
              scope: attributes?.scope ?? 'workspace',
              heading: attributes?.heading ?? this.options.defaultHeading(),
            }),
          );
          const before = tr.steps.length;
          const inserted = commands.insertContent(node);
          if (dispatch && !attributes && tr.steps.length > before) {
            tr.steps
              .at(-1)
              .getMap()
              .forEach((_a, _b, from, to) => {
                tr.doc.nodesBetween(from, to, (child, pos) => {
                  if (child.type === this.type)
                    tr.setMeta(pagesByLabelSettingsKey, pos);
                });
              });
          }
          return inserted;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pagesByLabelSettingsKey,
        state: {
          init: () => null,
          apply(tr, pos: number | null) {
            const request = tr.getMeta(pagesByLabelSettingsKey);
            if (request !== undefined) return request;
            if (pos === null) return null;
            const mapped = tr.mapping.mapResult(pos);
            return mapped.deleted ? null : mapped.pos;
          },
        },
      }),
    ];
  },

  addNodeView() {
    if (!this.options.view) return null;
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
