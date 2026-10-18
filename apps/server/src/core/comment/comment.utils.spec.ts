import { BadRequestException } from '@nestjs/common';
import {
  assertReaderCommentAllowed,
  isCommentVisible,
  isInternalComment,
  shouldStampInternal,
  toViewerComment,
} from './comment.utils';

const READER = { controlled: true, canAccessDraft: false };
const DRAFT_USER = { controlled: true, canAccessDraft: true };
const UNCONTROLLED_VIEWER = { controlled: false, canAccessDraft: false };
const UNCONTROLLED_EDITOR = { controlled: false, canAccessDraft: true };

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
const stampedRoot = { ...inlineRoot, isInternal: true };
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
    expect(isCommentVisible(reply, stampedRoot, DRAFT_USER)).toBe(true);
    expect(isCommentVisible(pageRoot, null, DRAFT_USER)).toBe(true);
  });

  it('shows unstamped inline threads to everyone on an uncontrolled page', () => {
    expect(isCommentVisible(inlineRoot, null, UNCONTROLLED_VIEWER)).toBe(true);
    expect(isCommentVisible(reply, inlineRoot, UNCONTROLLED_VIEWER)).toBe(true);
  });

  it('keeps a stamped thread hidden from a reader after the page becomes uncontrolled', () => {
    expect(isCommentVisible(stampedRoot, null, UNCONTROLLED_VIEWER)).toBe(false);
    expect(isCommentVisible(reply, stampedRoot, UNCONTROLLED_VIEWER)).toBe(
      false,
    );
  });

  it('shows a stamped thread to an editor after the page becomes uncontrolled', () => {
    expect(isCommentVisible(stampedRoot, null, UNCONTROLLED_EDITOR)).toBe(true);
    expect(isCommentVisible(reply, stampedRoot, UNCONTROLLED_EDITOR)).toBe(
      true,
    );
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

  it('hides a reply flagged internal inside a page-level thread on any page', () => {
    const agentReply = { ...reply, isInternal: true };

    expect(isCommentVisible(agentReply, pageRoot, READER)).toBe(false);
    expect(isCommentVisible(agentReply, pageRoot, UNCONTROLLED_VIEWER)).toBe(
      false,
    );
    expect(isCommentVisible(agentReply, pageRoot, DRAFT_USER)).toBe(true);
  });

  it('fails closed for a root without a type and a reply without its root', () => {
    expect(isCommentVisible({ ...pageRoot, type: null }, null, READER)).toBe(
      false,
    );
    expect(isCommentVisible(reply, null, READER)).toBe(false);
    expect(isCommentVisible(reply, null, UNCONTROLLED_VIEWER)).toBe(false);
  });

  it('ignores the stored type of a reply', () => {
    const legacyReply = { ...reply, type: 'inline' };

    expect(isCommentVisible(legacyReply, pageRoot, READER)).toBe(true);
  });
});

describe('isInternalComment', () => {
  it('follows the root for replies and the comment itself for roots', () => {
    expect(isInternalComment(pageRoot, null, true)).toBe(false);
    expect(isInternalComment(inlineRoot, null, true)).toBe(true);
    expect(isInternalComment(reply, pageRoot, true)).toBe(false);
    expect(isInternalComment(reply, inlineRoot, true)).toBe(true);
  });

  it('counts only stamped comments on uncontrolled pages', () => {
    expect(isInternalComment(inlineRoot, null, false)).toBe(false);
    expect(isInternalComment(reply, inlineRoot, false)).toBe(false);
    expect(isInternalComment(stampedRoot, null, false)).toBe(true);
    expect(isInternalComment(reply, stampedRoot, false)).toBe(true);
  });
});

describe('shouldStampInternal', () => {
  const base = {
    controlled: true,
    canAccessDraft: true,
    type: 'page',
    selection: null,
  };

  it('stamps inline, quoted and anchored thread roots on controlled pages', () => {
    expect(shouldStampInternal({ ...base, type: 'inline' })).toBe(true);
    expect(shouldStampInternal({ ...base, selection: 'quote' })).toBe(true);
    expect(
      shouldStampInternal({ ...base, yjsSelection: { anchor: {}, head: {} } }),
    ).toBe(true);
  });

  it('stamps agent comments of draft users, replies included', () => {
    expect(shouldStampInternal({ ...base, source: 'mcp' })).toBe(true);
    expect(
      shouldStampInternal({
        ...base,
        source: 'ai-chat',
        parentCommentId: 'root-1',
      }),
    ).toBe(true);
  });

  it('leaves plain page-level roots, human replies and readers unstamped', () => {
    expect(shouldStampInternal(base)).toBe(false);
    expect(
      shouldStampInternal({
        ...base,
        parentCommentId: 'root-1',
        type: 'inline',
        selection: 'quote',
      }),
    ).toBe(false);
    expect(
      shouldStampInternal({ ...base, canAccessDraft: false, source: 'mcp' }),
    ).toBe(false);
  });

  it('never stamps on uncontrolled pages', () => {
    expect(
      shouldStampInternal({
        ...base,
        controlled: false,
        type: 'inline',
        selection: 'quote',
        source: 'mcp',
      }),
    ).toBe(false);
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

  it('rejects a reply to a stamped thread from a non-editor of an uncontrolled page', () => {
    expectRejected(
      () =>
        assertReaderCommentAllowed(
          { parentCommentId: 'root-1' },
          stampedRoot,
          UNCONTROLLED_VIEWER,
        ),
      'Parent comment not found',
    );
  });

  it('lets a non-editor of an uncontrolled page comment inline and reply to unstamped threads', () => {
    expect(() =>
      assertReaderCommentAllowed(
        { type: 'inline', selection: 'quote', yjsSelection: { anchor: {}, head: {} } },
        null,
        UNCONTROLLED_VIEWER,
      ),
    ).not.toThrow();
    expect(() =>
      assertReaderCommentAllowed(
        { parentCommentId: 'root-1' },
        inlineRoot,
        UNCONTROLLED_VIEWER,
      ),
    ).not.toThrow();
  });

  it('never throws for draft users or editors', () => {
    for (const opts of [DRAFT_USER, UNCONTROLLED_EDITOR]) {
      expect(() =>
        assertReaderCommentAllowed(
          {
            type: 'inline',
            selection: 'quote',
            yjsSelection: { anchor: {}, head: {} },
            parentCommentId: 'root-1',
          },
          stampedRoot,
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
    expect(toViewerComment(comment, UNCONTROLLED_VIEWER)).toBe(comment);
  });
});
