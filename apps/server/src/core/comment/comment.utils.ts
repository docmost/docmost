import { BadRequestException } from '@nestjs/common';

export type CommentSource = 'mcp' | 'ai-chat';

export type CommentVisibilityFields = {
  type: string | null;
  isInternal: boolean;
  selection: string | null;
};

export type CommentVisibilityOpts = {
  controlled: boolean;
  canAccessDraft: boolean;
};

export type CommentAccess = CommentVisibilityOpts & { internal: boolean };

// CommentRepo.findPageComments mirrors these rules in SQL.
export function isInternalThreadRoot(root: CommentVisibilityFields): boolean {
  return root.isInternal || root.type !== 'page' || root.selection != null;
}

export function isInternalComment(
  comment: CommentVisibilityFields & { parentCommentId: string | null },
  root: CommentVisibilityFields | null,
): boolean {
  if (!comment.parentCommentId) return isInternalThreadRoot(comment);
  return comment.isInternal || !root || isInternalThreadRoot(root);
}

export function isCommentVisible(
  comment: CommentVisibilityFields & { parentCommentId: string | null },
  root: CommentVisibilityFields | null,
  opts: CommentVisibilityOpts,
): boolean {
  if (!opts.controlled || opts.canAccessDraft) return true;
  return !isInternalComment(comment, root);
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
  if (!opts.controlled || opts.canAccessDraft) return;

  if ((dto.type ?? 'page') !== 'page' || dto.yjsSelection || dto.selection) {
    throw new BadRequestException(
      'Only page-level comments are allowed on this page',
    );
  }

  if (
    dto.parentCommentId &&
    (!parentRoot || isInternalThreadRoot(parentRoot))
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
