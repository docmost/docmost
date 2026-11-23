import {
  normalizeRecentlyUpdatedLimit,
  recentlyUpdatedFiltersWithinLimits,
  type RecentlyUpdatedFilters,
} from '@docmost/editor-ext';
import type { Cheerio, CheerioAPI } from 'cheerio';
import { validate as isUuid } from 'uuid';

export type ConfluenceSpaceIds = Readonly<Record<string, string | null>>;

export interface ConfluenceRecentUpdates {
  hasCql?: boolean;
  limit?: string;
  hideHeading?: boolean;
  types?: string[];
  spaces?: string[];
  labels?: string[];
}

export function confluenceFilterValues(value: string): string[] {
  return value.split(/[,\s]+/).filter(Boolean);
}

function readConfluenceFilter(tokens: string[] = []) {
  const required: string[] = [];
  const included: string[] = [];
  const excluded: string[] = [];
  for (const token of tokens) {
    const sign = token[0];
    const name = sign === '+' || sign === '-' ? token.slice(1).trim() : token;
    if (!name) throw new Error('A filter value is missing.');
    if (sign === '+') required.push(name);
    else if (sign === '-') excluded.push(name);
    else included.push(name);
  }
  return {
    included: [...new Set(required.length ? required : included)],
    excluded: [...new Set(excluded)],
    match: required.length > 1 ? ('all' as const) : ('any' as const),
  };
}

export interface ConfluenceSpaceContext {
  spaces?: ConfluenceSpaceIds;
  sourceSpaceKey?: string;
  destinationSpaceId?: string;
}

function recentUpdateScope(
  values: string[] | undefined,
  { spaces, sourceSpaceKey, destinationSpaceId }: ConfluenceSpaceContext,
): Pick<RecentlyUpdatedFilters, 'scope' | 'spaceIds' | 'excludeSpaceIds'> {
  const { included, excluded, match } = readConfluenceFilter(
    values?.length ? values : ['@self'],
  );
  function lookup(key: string) {
    return spaces && Object.prototype.hasOwnProperty.call(spaces, key)
      ? spaces[key]
      : undefined;
  }
  const sourceKey = sourceSpaceKey?.toUpperCase();
  const currentId = destinationSpaceId ?? (sourceKey && lookup(sourceKey));
  function fixedId(value: string) {
    const key = value.toUpperCase();
    const id = key === '@SELF' || key === sourceKey ? currentId : lookup(key);
    if (!id || !isUuid(id)) {
      throw new Error(
        `The source space "${value}" has no unambiguous destination.`,
      );
    }
    return id.toLowerCase();
  }
  function resolve(value: string) {
    switch (value.toLowerCase()) {
      case '*':
      case '@all':
        return 'workspace';
      case '@self':
        return 'current';
      default:
        if (value.startsWith('@')) {
          throw new Error(`The space selector "${value}" is unsupported.`);
        }
        return fixedId(value);
    }
  }

  const excludeSpaceIds = new Set<string>();
  for (const value of excluded) {
    const resolved = resolve(value);
    if (resolved === 'workspace')
      throw new Error('The filter excludes all spaces.');
    excludeSpaceIds.add(resolved === 'current' ? fixedId('@self') : resolved);
  }
  const allowed = new Set(included.map(resolve));
  const allSpaces = allowed.delete('workspace');
  const exclusions = [...excludeSpaceIds];
  if (!allowed.size || (allSpaces && match === 'any')) {
    return { scope: 'workspace', spaceIds: [], excludeSpaceIds: exclusions };
  }
  if (
    allowed.size === 1 &&
    allowed.has('current') &&
    !excluded.some((value) => value.toLowerCase() === '@self')
  ) {
    return { scope: 'current', spaceIds: [], excludeSpaceIds: exclusions };
  }
  const spaceIds = [
    ...new Set(
      [...allowed].map((value) =>
        value === 'current' ? fixedId('@self') : value,
      ),
    ),
  ];
  if (match === 'all' && spaceIds.length > 1) {
    throw new Error('A page cannot belong to multiple required spaces.');
  }
  return { scope: 'spaces', spaceIds, excludeSpaceIds: exclusions };
}

export function replaceConfluenceRecentUpdates(
  $: CheerioAPI,
  macro: Cheerio<any>,
  params: ConfluenceRecentUpdates,
  context: ConfluenceSpaceContext = {},
) {
  let filters: RecentlyUpdatedFilters;
  try {
    if (params.hasCql) throw new Error('CQL is unsupported for this macro.');
    const types = readConfluenceFilter(
      params.types?.map((type) => type.toLowerCase()),
    );
    const allowsPages =
      !types.included.length ||
      (types.match === 'all'
        ? types.included.every((type) => type === 'page')
        : types.included.includes('page'));
    if (!allowsPages || types.excluded.includes('page')) {
      throw new Error((params.types ?? []).join(', '));
    }

    const labels = readConfluenceFilter(params.labels);
    filters = {
      ...recentUpdateScope(params.spaces, context),
      labels: labels.included,
      excludeLabels: labels.excluded,
      match: labels.match,
    };
    if (!recentlyUpdatedFiltersWithinLimits(filters)) {
      throw new Error('The filter exceeds the supported limits.');
    }
  } catch (error) {
    macro.replaceWith(
      $('<em>').text(
        `[Confluence macro: recently-updated (${(error as Error).message})]`,
      ),
    );
    return;
  }
  const block = $('<div></div>').attr({
    'data-type': 'recently-updated',
    'data-limit': String(normalizeRecentlyUpdatedLimit(params.limit)),
    'data-hide-heading': String(params.hideHeading === true),
    'data-scope': filters.scope,
    'data-match': filters.match,
  });
  const lists = {
    'data-space-ids': filters.spaceIds,
    'data-exclude-space-ids': filters.excludeSpaceIds,
    'data-labels': filters.labels,
    'data-exclude-labels': filters.excludeLabels,
  };
  for (const [attribute, values] of Object.entries(lists)) {
    if (values.length) block.attr(attribute, JSON.stringify(values));
  }
  macro.replaceWith(block);
}

const macroSelector =
  '[data-macro-name="recently-updated"], div.recently-updated';

export function formatConfluenceRecentUpdates(
  $: CheerioAPI,
  root: Cheerio<any>,
  destinationSpaceId?: string,
  exportContext?: { spaceKey?: string },
) {
  const macros = root.find(macroSelector);
  if (!macros.length) return;
  const sourceSpaceKey = exportContext
    ? exportContext.spaceKey
    : $('head meta[name="ajs-space-key"]').attr('content')?.trim();
  macros.each((_, el) => {
    const macro = $(el);
    if (macro.parents('[data-macro-name="recently-updated"]').length) return;
    const declaredName = macro.attr('data-macro-name');
    if (declaredName && declaredName !== 'recently-updated') return;
    // A named editor wrapper and its inner rendered body describe the same macro.
    const bodies = macro.add(
      declaredName
        ? macro.find('div.recently-updated').filter((_, body) => {
            const inner = $(body);
            const name = inner.attr('data-macro-name');
            return (
              (!name || name === declaredName) &&
              inner.parents('[data-macro-name]').first()[0] === el
            );
          })
        : [],
    );
    const changes = macro
      .find('input[id="changesUrl"]')
      .filter((_, input) => bodies.is($(input).closest(macroSelector)));
    if (changes.length > 1) {
      macro.replaceWith($('<em>').text('[Confluence macro: recently-updated]'));
      return;
    }
    const rawUrl = changes.attr('value')?.trim();
    const url =
      rawUrl && URL.canParse(rawUrl, 'https://confluence.invalid')
        ? new URL(rawUrl, 'https://confluence.invalid')
        : undefined;
    const isChangesUrl = url?.pathname.endsWith(
      '/plugins/recently-updated/changes.action',
    );
    if (!declaredName && !exportContext && !sourceSpaceKey && !isChangesUrl)
      return;
    const options = new URLSearchParams();
    const saved = new Set(
      bodies.map((_, body) => $(body).attr('data-macro-parameters')).get(),
    );
    if (saved.size > 1) {
      macro.replaceWith($('<em>').text('[Confluence macro: recently-updated]'));
      return;
    }
    const [metadata] = saved;
    if (metadata) {
      for (const pair of metadata.split('|')) {
        const i = pair.indexOf('=');
        const key = pair.slice(0, i).trim();
        if (i <= 0 || !/^[\w.-]+$/.test(key)) {
          macro.replaceWith(
            $('<em>').text('[Confluence macro: recently-updated]'),
          );
          return;
        }
        options.append(key, pair.slice(i + 1));
      }
    }
    if (changes.length && !isChangesUrl) {
      macro.replaceWith($('<em>').text('[Confluence macro: recently-updated]'));
      return;
    }
    const values = (rendered: string, storage = rendered) => {
      const raw = url?.searchParams.has(rendered)
        ? url.searchParams.getAll(rendered)
        : options.getAll(options.has(storage) ? storage : rendered);
      return raw.flatMap(confluenceFilterValues);
    };
    const hidden =
      url?.searchParams.get('hideHeading') ?? options.get('hideHeading');
    replaceConfluenceRecentUpdates(
      $,
      macro,
      {
        hasCql: [
          ...(url?.searchParams.getAll('cql') ?? []),
          ...options.getAll('cql'),
        ].some((value) => value.trim()),
        limit: url?.searchParams.get('pageSize') ?? options.get('max'),
        hideHeading:
          hidden != null
            ? hidden === 'true'
            : !bodies.children('h1,h2,h3,h4,h5,h6').length,
        types: values('contentType', 'types'),
        // Saved parameters preserve empty and relative scopes that a rendered URL may expand.
        spaces:
          metadata !== undefined
            ? options
                .getAll(options.has('spaces') ? 'spaces' : 'spaceKeys')
                .flatMap(confluenceFilterValues)
            : values('spaceKeys', 'spaces'),
        labels: values('labels'),
      },
      { sourceSpaceKey, destinationSpaceId },
    );
  });
}
