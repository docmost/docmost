import { isDeepStrictEqual } from 'node:util';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { Page } from '@docmost/db/types/entity.types';
import { tiptapExtensions } from '../../../collaboration/collaboration.util';
import {
  extractInternalLinkSlugIds,
  extractMentions,
  extractPageMentions,
  getAttachmentIds,
} from '../../../common/helpers/prosemirror/utils';
import { IPageBacklinkJob } from '../../../integrations/queue/constants/queue.interface';

export const DRAFT_RESET_FAILED_MESSAGE =
  'The draft could not be reset, so nothing was published.';

export const SUBMISSION_NOT_PENDING_MESSAGE =
  'This submission is no longer pending approval.';

export const PAGE_NOT_CONTROLLED_MESSAGE =
  'This page no longer requires approval.';

type TitleIcon = { title: string | null; icon: string | null };

// A cleared draft value is stored as '', which reads the same as null.
function sameTitleIconValue(a: string | null, b: string | null): boolean {
  return (a || null) === (b || null);
}

// True when clearing the draft overrides keeps its effective title and icon.
export function draftOverridesMatch(
  draft: TitleIcon,
  published: TitleIcon,
): boolean {
  const hasOverride = draft.title !== null || draft.icon !== null;
  return (
    hasOverride &&
    (draft.title === null ||
      sameTitleIconValue(draft.title, published.title)) &&
    (draft.icon === null || sameTitleIconValue(draft.icon, published.icon))
  );
}

export function attachmentIdsOf(content: unknown): string[] {
  return content ? getAttachmentIds(content) : [];
}

export function mergeContributorIds(
  current: string[] | null | undefined,
  added: string[] | null | undefined,
): string[] {
  return [...new Set([...(current ?? []), ...(added ?? [])])];
}

export function buildBacklinkJob(
  page: Pick<Page, 'id' | 'workspaceId'>,
  content: unknown,
): IPageBacklinkJob {
  return {
    pageId: page.id,
    workspaceId: page.workspaceId,
    mentions: content ? extractPageMentions(extractMentions(content)) : [],
    internalLinkSlugIds: content ? extractInternalLinkSlugIds(content) : [],
  };
}

// JSONB drops undefined values and gives plain objects, as JSON does.
function toPlainJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null));
}

// The collab store saves what Yjs returns, with schema defaults filled in.
export function matchesResetContent(
  stored: unknown,
  expected: unknown,
): boolean {
  const storedJson = toPlainJson(stored);
  if (isDeepStrictEqual(storedJson, toPlainJson(expected))) return true;
  try {
    const ydoc = TiptapTransformer.toYdoc(
      expected,
      'default',
      tiptapExtensions,
    );
    return isDeepStrictEqual(
      storedJson,
      toPlainJson(TiptapTransformer.fromYdoc(ydoc, 'default')),
    );
  } catch {
    return false;
  }
}

export function buildTreeUpdateEvent(page: Page) {
  return {
    operation: 'updateOne',
    spaceId: page.spaceId,
    entity: ['pages'],
    id: page.id,
    payload: {
      title: page.title,
      slugId: page.slugId,
      parentPageId: page.parentPageId,
      icon: page.icon,
    },
  };
}

export function buildApprovalPublishedEvent(page: Page) {
  return {
    operation: 'pageApprovalPublished',
    pageId: page.id,
    spaceId: page.spaceId,
    slugId: page.slugId,
  };
}
