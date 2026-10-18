import {
  buildApprovalState,
  DRAFT_CONTENT_NOTE,
  effectiveDraftTitleIcon,
  isApprovalControlled,
  isApprovalLocked,
  isHistoryRowVisible,
  isSpaceControlledRow,
  mergeApproverIds,
  planSpaceMove,
  readSpaceApprovalSettings,
  toDraftTitleIcon,
  withDraftNote,
} from './page-approval.utils';

describe('isApprovalControlled', () => {
  it('is false for a base page even with a qms verification', () => {
    expect(
      isApprovalControlled({
        isBase: true,
        verificationType: 'qms',
        spaceApprovalEnabled: true,
      }),
    ).toBe(false);
  });

  it('is true for a qms verification', () => {
    expect(
      isApprovalControlled({
        isBase: false,
        verificationType: 'qms',
        spaceApprovalEnabled: false,
      }),
    ).toBe(true);
  });

  it('is true when the space requires approval', () => {
    expect(
      isApprovalControlled({
        isBase: false,
        verificationType: null,
        spaceApprovalEnabled: true,
      }),
    ).toBe(true);
  });

  it('is false for an expiring verification alone', () => {
    expect(
      isApprovalControlled({
        isBase: false,
        verificationType: 'expiring',
        spaceApprovalEnabled: false,
      }),
    ).toBe(false);
  });
});

describe('isApprovalLocked', () => {
  it('locks in_approval and obsolete', () => {
    expect(isApprovalLocked('in_approval')).toBe(true);
    expect(isApprovalLocked('obsolete')).toBe(true);
  });

  it('does not lock draft, approved or no status', () => {
    expect(isApprovalLocked('draft')).toBe(false);
    expect(isApprovalLocked('approved')).toBe(false);
    expect(isApprovalLocked(null)).toBe(false);
  });
});

describe('mergeApproverIds', () => {
  it('adds page approvers to space approvers when the space requires approval', () => {
    expect(mergeApproverIds(['a', 'b'], ['b', 'c'], true)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('uses only page approvers otherwise', () => {
    expect(mergeApproverIds(['a'], ['c'], false)).toEqual(['c']);
  });
});

describe('effectiveDraftTitleIcon', () => {
  it('falls back to the page value for each null draft field', () => {
    expect(
      effectiveDraftTitleIcon(
        { title: null, icon: 'x' },
        { title: 'T', icon: 'y' },
      ),
    ).toEqual({ title: 'T', icon: 'x' });
  });

  it('keeps an empty draft title and uses the page values without a draft', () => {
    expect(
      effectiveDraftTitleIcon({ title: '', icon: null }, { title: 'T', icon: 'y' }),
    ).toEqual({ title: '', icon: 'y' });
    expect(effectiveDraftTitleIcon(null, { title: 'T', icon: 'y' })).toEqual({
      title: 'T',
      icon: 'y',
    });
  });
});

describe('isHistoryRowVisible', () => {
  it('hides draft rows from users without draft access on an uncontrolled page', () => {
    expect(
      isHistoryRowVisible('draft', { controlled: false, canAccessDraft: false }),
    ).toBe(false);
  });

  it('shows draft rows to draft users', () => {
    expect(
      isHistoryRowVisible('draft', { controlled: true, canAccessDraft: true }),
    ).toBe(true);
  });

  it('shows reader versions to readers of a controlled page', () => {
    expect(
      isHistoryRowVisible('approved', { controlled: true, canAccessDraft: false }),
    ).toBe(true);
    expect(
      isHistoryRowVisible('baseline', { controlled: true, canAccessDraft: false }),
    ).toBe(true);
  });

  it('hides regular rows from readers of a controlled page', () => {
    expect(
      isHistoryRowVisible(null, { controlled: true, canAccessDraft: false }),
    ).toBe(false);
  });

  it('shows regular rows on an uncontrolled page', () => {
    expect(
      isHistoryRowVisible(null, { controlled: false, canAccessDraft: false }),
    ).toBe(true);
  });
});

describe('toDraftTitleIcon', () => {
  it('stores a cleared title or icon as an empty string', () => {
    expect(toDraftTitleIcon({ title: null, icon: null })).toEqual({
      title: '',
      icon: '',
    });
  });

  it('passes values through and leaves missing fields undefined', () => {
    expect(toDraftTitleIcon({ title: 'T' })).toEqual({
      title: 'T',
      icon: undefined,
    });
  });
});

describe('withDraftNote', () => {
  it('adds the draft note to draft content', () => {
    expect(withDraftNote({ id: 'p1' }, true)).toEqual({
      id: 'p1',
      note: DRAFT_CONTENT_NOTE,
    });
  });

  it('puts the draft note before an existing note', () => {
    expect(withDraftNote({ note: 'This page is large.' }, true).note).toBe(
      `${DRAFT_CONTENT_NOTE} This page is large.`,
    );
  });

  it('returns approved content unchanged', () => {
    const value = { id: 'p1', note: 'This page is large.' };
    expect(withDraftNote(value, false)).toBe(value);
  });
});

describe('readSpaceApprovalSettings', () => {
  it('reads enabled and approver ids', () => {
    expect(
      readSpaceApprovalSettings({ approval: { enabled: true, approverIds: ['u'] } }),
    ).toEqual({ enabled: true, approverIds: ['u'], disabling: false });
  });

  it('defaults to disabled without settings', () => {
    expect(readSpaceApprovalSettings(null)).toEqual({
      enabled: false,
      approverIds: [],
      disabling: false,
    });
  });

  it('accepts the string true like the SQL filters and nothing else', () => {
    expect(
      readSpaceApprovalSettings({
        approval: { enabled: 'true', disabling: 'true' },
      }),
    ).toMatchObject({ enabled: true, disabling: true });
    for (const value of [false, 'false', 'TRUE', 1, [true], { on: true }]) {
      expect(
        readSpaceApprovalSettings({
          approval: { enabled: value, disabling: value },
        }),
      ).toMatchObject({ enabled: false, disabling: false });
    }
  });

  it('reads disabling on its own', () => {
    expect(
      readSpaceApprovalSettings({
        approval: { enabled: false, disabling: true, approverIds: ['u'] },
      }),
    ).toEqual({ enabled: false, approverIds: ['u'], disabling: true });
  });

  it('keeps only distinct string approver ids from an array', () => {
    expect(
      readSpaceApprovalSettings({
        approval: { enabled: true, approverIds: ['u', 7, null, 'u', 'v'] },
      }).approverIds,
    ).toEqual(['u', 'v']);
    for (const approverIds of ['u', { u: true }, null]) {
      expect(
        readSpaceApprovalSettings({ approval: { enabled: true, approverIds } })
          .approverIds,
      ).toEqual([]);
    }
  });

  it('treats malformed settings as disabled', () => {
    for (const settings of [
      undefined,
      'approval',
      [],
      { approval: null },
      { approval: 'on' },
      { approval: [true] },
    ]) {
      expect(readSpaceApprovalSettings(settings)).toEqual({
        enabled: false,
        approverIds: [],
        disabling: false,
      });
    }
  });
});

describe('buildApprovalState', () => {
  const spaceOn = { approval: { enabled: true, approverIds: ['u'] } };

  it('marks a page in an approval space without a row as space controlled and unpublished', () => {
    expect(buildApprovalState({ isBase: false, spaceSettings: spaceOn })).toEqual({
      controlled: true,
      source: 'space',
      verificationId: null,
      status: null,
      locked: false,
      hasReaderVersion: false,
      unpublished: true,
      spaceRequiresApproval: true,
      pendingHistoryId: null,
      readerVersionId: null,
      disabling: false,
    });
  });

  it('is published once the page points at a reader version', () => {
    expect(
      buildApprovalState({
        isBase: false,
        readerVersionId: 'h1',
        spaceSettings: spaceOn,
      }),
    ).toMatchObject({
      controlled: true,
      hasReaderVersion: true,
      unpublished: false,
      readerVersionId: 'h1',
    });
  });

  it('keeps the space in force while approval is being disabled', () => {
    expect(
      buildApprovalState({
        isBase: false,
        spaceSettings: { approval: { enabled: false, disabling: true } },
      }),
    ).toMatchObject({
      controlled: true,
      source: 'space',
      spaceRequiresApproval: true,
      disabling: true,
      unpublished: true,
    });
  });

  it('reads the qms row of a per-page controlled page', () => {
    expect(
      buildApprovalState({
        isBase: false,
        readerVersionId: 'h1',
        spaceSettings: null,
        verificationId: 'v1',
        verificationType: 'qms',
        verificationStatus: 'in_approval',
        verificationSource: 'page',
        pendingHistoryId: 'h2',
      }),
    ).toEqual({
      controlled: true,
      source: 'page',
      verificationId: 'v1',
      status: 'in_approval',
      locked: true,
      hasReaderVersion: true,
      unpublished: false,
      spaceRequiresApproval: false,
      pendingHistoryId: 'h2',
      readerVersionId: 'h1',
      disabling: false,
    });
  });

  it('reports a space-sourced qms row in an approval space', () => {
    expect(
      buildApprovalState({
        isBase: false,
        spaceSettings: spaceOn,
        verificationId: 'v1',
        verificationType: 'qms',
        verificationStatus: 'obsolete',
        verificationSource: 'space',
      }),
    ).toMatchObject({
      controlled: true,
      source: 'space',
      verificationId: 'v1',
      status: 'obsolete',
      locked: true,
    });
  });

  it('ignores an expiring row', () => {
    expect(
      buildApprovalState({
        isBase: false,
        verificationId: 'v1',
        verificationType: 'expiring',
        verificationStatus: null,
        verificationSource: 'page',
      }),
    ).toMatchObject({
      controlled: false,
      source: null,
      verificationId: null,
      status: null,
      locked: false,
      unpublished: false,
    });
    expect(
      buildApprovalState({
        isBase: false,
        spaceSettings: spaceOn,
        verificationId: 'v1',
        verificationType: 'expiring',
      }),
    ).toMatchObject({ controlled: true, source: 'space', verificationId: null });
  });

  it('never controls a base page', () => {
    expect(
      buildApprovalState({
        isBase: true,
        spaceSettings: spaceOn,
        verificationId: 'v1',
        verificationType: 'qms',
        verificationStatus: 'in_approval',
        verificationSource: 'page',
        pendingHistoryId: 'h2',
      }),
    ).toMatchObject({
      controlled: false,
      source: null,
      verificationId: null,
      status: null,
      locked: false,
      unpublished: false,
      pendingHistoryId: null,
      spaceRequiresApproval: true,
    });
  });

  it('drops an unknown status', () => {
    expect(
      buildApprovalState({
        isBase: false,
        verificationId: 'v1',
        verificationType: 'qms',
        verificationStatus: 'verified',
        verificationSource: 'page',
      }),
    ).toMatchObject({ controlled: true, status: null, locked: false });
  });
});

describe('planSpaceMove', () => {
  const on = { approval: { enabled: true, approverIds: ['u'] } };
  const disabling = { approval: { enabled: false, disabling: true } };
  const off = { approval: { enabled: false } };

  it('publishes space-controlled drafts and needs a source admin when leaving approval', () => {
    for (const target of [off, null]) {
      expect(planSpaceMove(on, target)).toEqual({
        requiresSourceAdmin: true,
        publishSpaceControlled: true,
        divertMovedPages: false,
      });
    }
  });

  it('diverts moved pages when entering approval, from any space', () => {
    for (const source of [null, off, on, disabling]) {
      expect(planSpaceMove(source, on)).toEqual({
        requiresSourceAdmin: false,
        publishSpaceControlled: false,
        divertMovedPages: true,
      });
    }
  });

  it('treats a space that is being disabled as requiring approval', () => {
    expect(planSpaceMove(disabling, off)).toMatchObject({
      requiresSourceAdmin: true,
      publishSpaceControlled: true,
    });
    expect(planSpaceMove(off, disabling)).toMatchObject({
      divertMovedPages: true,
    });
  });

  it('changes nothing between spaces without approval', () => {
    expect(planSpaceMove(null, off)).toEqual({
      requiresSourceAdmin: false,
      publishSpaceControlled: false,
      divertMovedPages: false,
    });
  });
});

describe('isSpaceControlledRow', () => {
  const row = (overrides: object) => ({
    isBase: false,
    verificationType: null,
    verificationSource: null,
    ...overrides,
  });

  it('is true for a page without a row, an expiring row or a space-sourced qms row', () => {
    expect(isSpaceControlledRow(row({}))).toBe(true);
    expect(
      isSpaceControlledRow(
        row({ verificationType: 'expiring', verificationSource: 'page' }),
      ),
    ).toBe(true);
    expect(
      isSpaceControlledRow(
        row({ verificationType: 'qms', verificationSource: 'space' }),
      ),
    ).toBe(true);
  });

  it('is false for a page-sourced qms row and for bases', () => {
    expect(
      isSpaceControlledRow(
        row({ verificationType: 'qms', verificationSource: 'page' }),
      ),
    ).toBe(false);
    expect(isSpaceControlledRow(row({ isBase: true }))).toBe(false);
  });
});
