import { canReadShares } from './share.util';

describe('canReadShares', () => {
  it('reads shares in an active space with sharing on', () => {
    expect(
      canReadShares({
        workspaceSettings: {},
        spaceSettings: {},
        archivedAt: null,
      }),
    ).toBe(true);
  });

  it('pauses shares while the space is archived', () => {
    expect(
      canReadShares({
        workspaceSettings: {},
        spaceSettings: {},
        archivedAt: new Date(),
      }),
    ).toBe(false);
  });

  it('keeps refusing when sharing is disabled', () => {
    const disabled = { sharing: { disabled: true } };

    expect(
      canReadShares({
        workspaceSettings: {},
        spaceSettings: disabled,
        archivedAt: null,
      }),
    ).toBe(false);
    expect(
      canReadShares({
        workspaceSettings: disabled,
        spaceSettings: {},
        archivedAt: null,
      }),
    ).toBe(false);
  });
});
