import { BadRequestException } from '@nestjs/common';

export type CommentSource = 'mcp' | 'ai-chat';

export type CommentVisibilityFields = {
  type: string | null;
  isInternal: boolean;
  selection: string | null;
};

// On uncontrolled pages draft access is edit access.
export type CommentVisibilityOpts = {
  controlled: boolean;
  canAccessDraft: boolean;
};

export type CommentViewerAccess = CommentVisibilityOpts & { canEdit: boolean };

export type CommentAccess = CommentViewerAccess & { internal: boolean };

// Stamped threads stay internal after control ends. CommentRepo.findPageComments mirrors this in SQL.
export function isInternalThreadRoot(
  root: CommentVisibilityFields,
  controlled: boolean,
): boolean {
  if (root.isInternal) return true;
  return controlled && (root.type !== 'page' || root.selection != null);
}

export function isInternalComment(
  comment: CommentVisibilityFields & { parentCommentId: string | null },
  root: CommentVisibilityFields | null,
  controlled: boolean,
): boolean {
  if (!comment.parentCommentId) return isInternalThreadRoot(comment, controlled);
  return comment.isInternal || !root || isInternalThreadRoot(root, controlled);
}

export function isCommentVisible(
  comment: CommentVisibilityFields & { parentCommentId: string | null },
  root: CommentVisibilityFields | null,
  opts: CommentVisibilityOpts,
): boolean {
  if (opts.canAccessDraft) return true;
  return !isInternalComment(comment, root, opts.controlled);
}

export function shouldStampInternal(input: {
  controlled: boolean;
  canAccessDraft: boolean;
  source?: CommentSource;
  parentCommentId?: string;
  type: string;
  selection: string | null;
  yjsSelection?: unknown;
}): boolean {
  if (!input.controlled) return false;
  if (input.canAccessDraft && input.source) return true;
  if (input.parentCommentId) return false;
  return (
    input.type !== 'page' || input.selection !== null || !!input.yjsSelection
  );
}

// parentRoot is null when the parent is missing or is itself a reply.
export function assertReaderCommentAllowed(
  dto: {
    type?: string;
    selection?: string;
    yjsSelection?: unknown;
    parentCommentId?: string;
  },
  parentRoot: CommentVisibilityFields | null,
  opts: CommentVisibilityOpts,
): void {
  if (opts.canAccessDraft) return;

  if (
    opts.controlled &&
    ((dto.type ?? 'page') !== 'page' || dto.yjsSelection || dto.selection)
  ) {
    throw new BadRequestException(
      'Only page-level comments are allowed on this page',
    );
  }

  if (
    dto.parentCommentId &&
    (!parentRoot || isInternalThreadRoot(parentRoot, opts.controlled))
  ) {
    throw new BadRequestException('Parent comment not found');
  }
}

export function toViewerComment<T extends { selection: string | null }>(
  comment: T,
  opts: CommentVisibilityOpts,
): T {
  if (!opts.controlled || opts.canAccessDraft) return comment;
  return { ...comment, selection: null };
}
