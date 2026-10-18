import { BadRequestException } from '@nestjs/common';
import {
  assertReaderCommentAllowed,
  isCommentVisible,
  isInternalComment,
  toViewerComment,
} from './comment.utils';

const READER = { controlled: true, canAccessDraft: false };
const DRAFT_USER = { controlled: true, canAccessDraft: true };
const UNCONTROLLED = { controlled: false, canAccessDraft: false };

const pageRoot = {
  type: 'page',
  isInternal: false,
  selection: null,
  parentCommentId: null,
};
const inlineRoot = {
  type: 'inline',
  isInternal: false,
  selection: 'quoted draft text',
  parentCommentId: null,
};
const reply = {
  type: 'page',
  isInternal: false,
  selection: null,
  parentCommentId: 'root-1',
};

describe('isCommentVisible', () => {
  it('shows a reader a page-level root and its replies on a controlled page', () => {
    expect(isCommentVisible(pageRoot, null, READER)).toBe(true);
    expect(isCommentVisible(reply, pageRoot, READER)).toBe(true);
  });

  it('hides an inline root and its replies from a reader on a controlled page', () => {
    expect(isCommentVisible(inlineRoot, null, READER)).toBe(false);
    expect(isCommentVisible(reply, inlineRoot, READER)).toBe(false);
  });

  it('shows a draft user every thread', () => {
    expect(isCommentVisible(inlineRoot, null, DRAFT_USER)).toBe(true);
    expect(isCommentVisible(reply, inlineRoot, DRAFT_USER)).toBe(true);
    expect(isCommentVisible(pageRoot, null, DRAFT_USER)).toBe(true);
  });

  it('shows everyone every thread on an uncontrolled page', () => {
    expect(isCommentVisible(inlineRoot, null, UNCONTROLLED)).toBe(true);
    expect(isCommentVisible(reply, inlineRoot, UNCONTROLLED)).toBe(true);
  });

  it('treats a page-level root with a selection as internal', () => {
    const quotedRoot = { ...pageRoot, selection: 'draft excerpt' };

    expect(isCommentVisible(quotedRoot, null, READER)).toBe(false);
    expect(isCommentVisible(reply, quotedRoot, READER)).toBe(false);
  });

  it('treats a root flagged internal as internal', () => {
    const agentRoot = { ...pageRoot, isInternal: true };

    expect(isCommentVisible(agentRoot, null, READER)).toBe(false);
    expect(isCommentVisible(reply, agentRoot, READER)).toBe(false);
    expect(isCommentVisible(agentRoot, null, DRAFT_USER)).toBe(true);
  });

  it('hides a reply flagged internal inside a page-level thread from readers', () => {
    const agentReply = { ...reply, isInternal: true };

    expect(isCommentVisible(agentReply, pageRoot, READER)).toBe(false);
    expect(isCommentVisible(agentReply, pageRoot, DRAFT_USER)).toBe(true);
  });

  it('fails closed for a root without a type and a reply without its root', () => {
    expect(isCommentVisible({ ...pageRoot, type: null }, null, READER)).toBe(
      false,
    );
    expect(isCommentVisible(reply, null, READER)).toBe(false);
  });

  it('ignores the stored type of a reply', () => {
    const legacyReply = { ...reply, type: 'inline' };

    expect(isCommentVisible(legacyReply, pageRoot, READER)).toBe(true);
  });
});

describe('isInternalComment', () => {
  it('follows the root for replies and the comment itself for roots', () => {
    expect(isInternalComment(pageRoot, null)).toBe(false);
    expect(isInternalComment(inlineRoot, null)).toBe(true);
    expect(isInternalComment(reply, pageRoot)).toBe(false);
    expect(isInternalComment(reply, inlineRoot)).toBe(true);
  });
});

describe('assertReaderCommentAllowed', () => {
  const expectRejected = (fn: () => void, message: string) => {
    expect(fn).toThrow(BadRequestException);
    expect(fn).toThrow(message);
  };

  it('rejects an inline comment from a reader', () => {
    expectRejected(
      () => assertReaderCommentAllowed({ type: 'inline' }, null, READER),
      'Only page-level comments are allowed on this page',
    );
  });

  it('rejects a yjsSelection from a reader', () => {
    expectRejected(
      () =>
        assertReaderCommentAllowed(
          { type: 'page', yjsSelection: { anchor: {}, head: {} } },
          null,
          READER,
        ),
      'Only page-level comments are allowed on this page',
    );
  });

  it('rejects a quoted selection from a reader', () => {
    expectRejected(
      () => assertReaderCommentAllowed({ selection: 'quote' }, null, READER),
      'Only page-level comments are allowed on this page',
    );
  });

  it('rejects a reader reply whose root is inline', () => {
    expectRejected(
      () =>
        assertReaderCommentAllowed(
          { parentCommentId: 'root-1' },
          inlineRoot,
          READER,
        ),
      'Parent comment not found',
    );
  });

  it('rejects a reader reply to an internal or quoted page-level root', () => {
    for (const root of [
      { ...pageRoot, isInternal: true },
      { ...pageRoot, selection: 'excerpt' },
    ]) {
      expectRejected(
        () =>
          assertReaderCommentAllowed({ parentCommentId: 'root-1' }, root, READER),
        'Parent comment not found',
      );
    }
  });

  it('rejects a reader reply when the parent is not a thread root', () => {
    expectRejected(
      () =>
        assertReaderCommentAllowed({ parentCommentId: 'reply-1' }, null, READER),
      'Parent comment not found',
    );
  });

  it('allows a reader a page-level comment and a reply to a page-level root', () => {
    expect(() => assertReaderCommentAllowed({}, null, READER)).not.toThrow();
    expect(() =>
      assertReaderCommentAllowed({ type: 'page' }, null, READER),
    ).not.toThrow();
    expect(() =>
      assertReaderCommentAllowed(
        { type: 'page', parentCommentId: 'root-1' },
        pageRoot,
        READER,
      ),
    ).not.toThrow();
  });

  it('never throws for draft users or on uncontrolled pages', () => {
    for (const opts of [DRAFT_USER, UNCONTROLLED]) {
      expect(() =>
        assertReaderCommentAllowed(
          {
            type: 'inline',
            selection: 'quote',
            yjsSelection: { anchor: {}, head: {} },
            parentCommentId: 'root-1',
          },
          inlineRoot,
          opts,
        ),
      ).not.toThrow();
      expect(() =>
        assertReaderCommentAllowed({ parentCommentId: 'reply-1' }, null, opts),
      ).not.toThrow();
    }
  });
});

describe('toViewerComment', () => {
  const comment = { id: 'c1', selection: 'quoted text' };

  it('removes the selection for readers of a controlled page', () => {
    expect(toViewerComment(comment, READER)).toEqual({
      id: 'c1',
      selection: null,
    });
    expect(comment.selection).toBe('quoted text');
  });

  it('keeps the selection for draft users and on uncontrolled pages', () => {
    expect(toViewerComment(comment, DRAFT_USER)).toBe(comment);
    expect(toViewerComment(comment, UNCONTROLLED)).toBe(comment);
  });
});
