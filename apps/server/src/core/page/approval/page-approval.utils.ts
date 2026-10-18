import {
  ApprovalState,
  ApprovalStateInput,
  ApprovalStatus,
  SpaceApprovalSettings,
} from './page-approval.types';

const APPROVAL_STATUSES: ApprovalStatus[] = [
  'draft',
  'in_approval',
  'approved',
  'obsolete',
];

export const PAGE_LOCKED_MESSAGE = 'This page is in review and cannot be edited.';

export const TRASH_APPROVED_PAGE_MESSAGE =
  'Only space admins and approvers can move approved pages to trash.';

export const MOVE_OUT_OF_APPROVAL_MESSAGE =
  'Only space admins can move pages out of a space that requires approval.';

export const SHARE_UNPUBLISHED_PAGE_MESSAGE = 'Cannot share an unpublished page';

export const DRAFT_CONTENT_NOTE =
  'This is the unpublished draft of an approval-controlled page.';

// MCP and AI chat outputs with draft content say so, before any other note.
export function withDraftNote<T extends object>(
  value: T,
  isDraft: boolean,
): T & { note?: string } {
  if (!isDraft) return value;
  const note = (value as { note?: string }).note;
  return {
    ...value,
    note: note ? `${DRAFT_CONTENT_NOTE} ${note}` : DRAFT_CONTENT_NOTE,
  };
}

export function isApprovalControlled(input: {
  isBase: boolean;
  verificationType: string | null;
  spaceApprovalEnabled: boolean;
}): boolean {
  if (input.isBase) return false;
  return input.verificationType === 'qms' || input.spaceApprovalEnabled;
}

export function isApprovalLocked(status: ApprovalStatus | null): boolean {
  return status === 'in_approval' || status === 'obsolete';
}

export function mergeApproverIds(
  spaceApproverIds: string[],
  pageVerifierIds: string[],
  spaceRequiresApproval: boolean,
): string[] {
  const ids = spaceRequiresApproval
    ? [...spaceApproverIds, ...pageVerifierIds]
    : pageVerifierIds;
  return [...new Set(ids)];
}

export function effectiveDraftTitleIcon(
  draft: { title: string | null; icon: string | null } | null,
  page: { title: string | null; icon: string | null },
): { title: string | null; icon: string | null } {
  return {
    title: draft?.title ?? page.title,
    icon: draft?.icon ?? page.icon,
  };
}

// A null draft field means "same as the page", so a cleared value is stored as ''.
export function toDraftTitleIcon(changes: {
  title?: string | null;
  icon?: string | null;
}): { title?: string; icon?: string } {
  return {
    title: changes.title === null ? '' : changes.title,
    icon: changes.icon === null ? '' : changes.icon,
  };
}

export function isHistoryRowVisible(
  kind: string | null,
  opts: { controlled: boolean; canAccessDraft: boolean },
): boolean {
  if (opts.canAccessDraft) return true;
  if (kind === 'draft') return false;
  return !opts.controlled || kind === 'approved' || kind === 'baseline';
}

// Matches spaceApprovalActiveSql, which accepts a JSON true or the string 'true'.
function isTrueFlag(value: unknown): boolean {
  return value === true || value === 'true';
}

export function readSpaceApprovalSettings(
  settings: unknown,
): SpaceApprovalSettings {
  const approval = (settings as { approval?: any } | null)?.approval;
  const approverIds: unknown[] = Array.isArray(approval?.approverIds)
    ? approval.approverIds
    : [];

  return {
    enabled: isTrueFlag(approval?.enabled),
    approverIds: [
      ...new Set(
        approverIds.filter((id): id is string => typeof id === 'string'),
      ),
    ],
    disabling: isTrueFlag(approval?.disabling),
  };
}

function requiresApproval(spaceSettings: unknown): boolean {
  const space = readSpaceApprovalSettings(spaceSettings);
  return space.enabled || space.disabling;
}

// Any move out of an approval space needs its admin, so approved pages cannot be laundered elsewhere.
export function planSpaceMove(
  source: { id: string; settings: unknown },
  target: { id: string; settings: unknown },
): {
  requiresSourceAdmin: boolean;
  publishSpaceControlled: boolean;
  divertMovedPages: boolean;
} {
  if (source.id === target.id) {
    return {
      requiresSourceAdmin: false,
      publishSpaceControlled: false,
      divertMovedPages: false,
    };
  }
  const fromApproval = requiresApproval(source.settings);
  const intoApproval = requiresApproval(target.settings);
  return {
    requiresSourceAdmin: fromApproval,
    publishSpaceControlled: fromApproval && !intoApproval,
    divertMovedPages: intoApproval,
  };
}

// Controlled by the space policy rather than by its own qms row.
export function isSpaceControlledRow(row: {
  isBase: boolean;
  verificationType: string | null;
  verificationSource: string | null;
}): boolean {
  if (row.isBase) return false;
  return !(row.verificationType === 'qms' && row.verificationSource !== 'space');
}

export function buildApprovalState(input: ApprovalStateInput): ApprovalState {
  const space = readSpaceApprovalSettings(input.spaceSettings);
  // Disabling keeps space approval in force until every page is published.
  const spaceRequiresApproval = space.enabled || space.disabling;
  const controlled = isApprovalControlled({
    isBase: input.isBase,
    verificationType: input.verificationType ?? null,
    spaceApprovalEnabled: spaceRequiresApproval,
  });
  const qmsRow = controlled && input.verificationType === 'qms';
  const status =
    qmsRow &&
    APPROVAL_STATUSES.includes(input.verificationStatus as ApprovalStatus)
      ? (input.verificationStatus as ApprovalStatus)
      : null;
  const readerVersionId = input.readerVersionId ?? null;

  let source: ApprovalState['source'] = null;
  if (qmsRow) {
    source = input.verificationSource === 'space' ? 'space' : 'page';
  } else if (controlled) {
    source = 'space';
  }

  return {
    controlled,
    source,
    verificationId: qmsRow ? (input.verificationId ?? null) : null,
    status,
    locked: isApprovalLocked(status),
    hasReaderVersion: readerVersionId !== null,
    unpublished: controlled && readerVersionId === null,
    spaceRequiresApproval,
    pendingHistoryId: qmsRow ? (input.pendingHistoryId ?? null) : null,
    readerVersionId,
    disabling: space.disabling,
  };
}
