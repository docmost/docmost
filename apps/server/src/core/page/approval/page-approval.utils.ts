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
