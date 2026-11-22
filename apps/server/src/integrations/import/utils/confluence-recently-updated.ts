import { normalizeRecentlyUpdatedLimit } from '@docmost/editor-ext';
import type { Cheerio, CheerioAPI } from 'cheerio';

export type ConfluenceSpaceIds = Readonly<Record<string, string | null>>;

export interface ConfluenceRecentUpdates {
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
    if (!name) return undefined;
    if (sign === '+') required.push(name);
    else if (sign === '-') excluded.push(name);
    else included.push(name);
  }
  return {
    included: required.length ? required : included,
    excluded,
    match: required.length > 1 ? 'all' : 'any',
  };
}

const scopeNames = new Map([
  ['@all', '@all'],
  ['*', '@all'],
  ['@self', '@self'],
  ['@global', '@global'],
  ['@personal', '@personal'],
  ['@favorite', '@favorite'],
  ['@favourite', '@favorite'],
]);

export function replaceConfluenceRecentUpdates(
  $: CheerioAPI,
  macro: Cheerio<any>,
  params: ConfluenceRecentUpdates,
  {
    spaces,
    renderedSpaceKey,
  }: {
    spaces?: ConfluenceSpaceIds;
    renderedSpaceKey?: string;
  } = {},
) {
  const types = (params.types ?? []).map((type) => type.toLowerCase());
  const requiredTypes = types.filter((type) => type.startsWith('+'));
  const includes = types.filter((type) => !type.startsWith('-'));
  const allowsPages = requiredTypes.length
    ? requiredTypes.every((type) => type === '+page')
    : !includes.length || includes.includes('page');
  if (types.includes('-page') || !allowsPages) {
    macro.replaceWith(
      $('<em>').text(
        `[Confluence macro: recently-updated (${types.join(', ')})]`,
      ),
    );
    return;
  }

  const block = $('<div></div>').attr({
    'data-type': 'recently-updated',
    'data-limit': String(normalizeRecentlyUpdatedLimit(params.limit)),
    'data-hide-heading': String(params.hideHeading === true),
  });
  // Confluence defaults an unspecified space filter to the containing space.
  const spaceFilter = readConfluenceFilter(
    params.spaces?.length ? params.spaces : ['@self'],
  );
  const labelFilter = readConfluenceFilter(params.labels);
  if (!spaceFilter || !labelFilter) {
    macro.replaceWith($('<em>').text('[Confluence macro: recently-updated]'));
    return;
  }
  const resolveSpace = (value: string) => {
    const scope = scopeNames.get(value.toLowerCase());
    if (scope) return scope;
    const key = value.toUpperCase();
    if (renderedSpaceKey?.toUpperCase() === key) return '@self';
    const id =
      spaces && Object.prototype.hasOwnProperty.call(spaces, key)
        ? spaces[key]
        : undefined;
    return id ?? '?' + value;
  };
  const lists = {
    'data-spaces': spaceFilter.included.map(resolveSpace),
    'data-exclude-spaces': spaceFilter.excluded.map(resolveSpace),
    'data-labels': labelFilter.included,
    'data-exclude-labels': labelFilter.excluded,
  };
  for (const [attribute, values] of Object.entries(lists)) {
    if (values.length) block.attr(attribute, JSON.stringify(values));
  }
  if (spaceFilter.match === 'all') block.attr('data-space-match', 'all');
  if (labelFilter.match === 'all') block.attr('data-match', 'all');
  macro.replaceWith(block);
}

const macroSelector =
  '[data-macro-name="recently-updated"], div.recently-updated';

export function formatConfluenceRecentUpdates(
  $: CheerioAPI,
  root: Cheerio<any>,
  exportContext?: { spaceKey?: string },
) {
  const macros = root.find(macroSelector);
  if (!macros.length) return;
  const spaceKey =
    $('meta[name="ajs-space-key"]').attr('content')?.trim() ||
    exportContext?.spaceKey;
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
    if (!declaredName && !exportContext && !spaceKey && !isChangesUrl) return;
    const options = new URLSearchParams();
    const metadata = bodies
      .filter('[data-macro-parameters]')
      .first()
      .attr('data-macro-parameters');
    if (metadata) {
      for (const pair of metadata.split('|')) {
        const i = pair.indexOf('=');
        if (i <= 0) {
          macro.replaceWith(
            $('<em>').text('[Confluence macro: recently-updated]'),
          );
          return;
        }
        options.append(pair.slice(0, i), pair.slice(i + 1));
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
        limit: url?.searchParams.get('pageSize') ?? options.get('max'),
        hideHeading:
          hidden != null
            ? hidden === 'true'
            : !bodies.children('h1,h2,h3,h4,h5,h6').length,
        types: values('contentType', 'types'),
        spaces: values('spaceKeys', 'spaces'),
        labels: values('labels'),
      },
      { renderedSpaceKey: spaceKey },
    );
  });
}
