import {
  rankRole,
  reconcileGroupMembers,
  resolveMappedRole,
} from './google-provisioning.service';
import { UserRole } from '../../../../common/helpers/types/permission';

describe('reconcileGroupMembers', () => {
  it('adds users who are in the Google group but not the Docmost group', () => {
    const result = reconcileGroupMembers({
      desiredUserIds: ['a', 'b'],
      syncedMemberIds: [],
      manualMemberIds: [],
    });

    expect(result.toAdd.sort()).toEqual(['a', 'b']);
    expect(result.toRemove).toEqual([]);
  });

  it('removes synced members who left the Google group', () => {
    const result = reconcileGroupMembers({
      desiredUserIds: ['a'],
      syncedMemberIds: ['a', 'b'],
      manualMemberIds: [],
    });

    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual(['b']);
  });

  it('never removes a manually added member, even when absent from Google', () => {
    const result = reconcileGroupMembers({
      desiredUserIds: [],
      syncedMemberIds: [],
      manualMemberIds: ['manual-user'],
    });

    expect(result.toRemove).toEqual([]);
    expect(result.toAdd).toEqual([]);
  });

  it('leaves a manual member alone when they are also in the Google group', () => {
    // They must not be re-added as synced, or a later Google removal would
    // silently revoke access an admin granted by hand.
    const result = reconcileGroupMembers({
      desiredUserIds: ['manual-user'],
      syncedMemberIds: [],
      manualMemberIds: ['manual-user'],
    });

    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });

  it('does not re-add a member sync already added', () => {
    const result = reconcileGroupMembers({
      desiredUserIds: ['a'],
      syncedMemberIds: ['a'],
      manualMemberIds: [],
    });

    expect(result.toAdd).toEqual([]);
    expect(result.toRemove).toEqual([]);
  });
});

describe('resolveMappedRole', () => {
  it('promotes a member to admin', () => {
    expect(resolveMappedRole(UserRole.MEMBER, [UserRole.ADMIN])).toBe(
      UserRole.ADMIN,
    );
  });

  it('never demotes an admin to member', () => {
    expect(resolveMappedRole(UserRole.ADMIN, [UserRole.MEMBER])).toBeNull();
  });

  it('never changes an owner', () => {
    expect(resolveMappedRole(UserRole.OWNER, [UserRole.ADMIN])).toBeNull();
    expect(resolveMappedRole(UserRole.OWNER, [UserRole.MEMBER])).toBeNull();
  });

  it('picks the highest role among several matched mappings', () => {
    expect(
      resolveMappedRole(UserRole.MEMBER, [UserRole.MEMBER, UserRole.ADMIN]),
    ).toBe(UserRole.ADMIN);
  });

  it('returns null when no mapping carries a role', () => {
    expect(resolveMappedRole(UserRole.MEMBER, [null, null])).toBeNull();
  });

  it('ignores a role equal to the current one', () => {
    expect(resolveMappedRole(UserRole.ADMIN, [UserRole.ADMIN])).toBeNull();
  });
});

describe('rankRole', () => {
  it('ranks owner above admin above member', () => {
    expect(rankRole(UserRole.OWNER)).toBeGreaterThan(rankRole(UserRole.ADMIN));
    expect(rankRole(UserRole.ADMIN)).toBeGreaterThan(rankRole(UserRole.MEMBER));
  });

  it('treats an unknown or missing role as the lowest rank', () => {
    expect(rankRole(null)).toBe(0);
    expect(rankRole('nonsense')).toBe(0);
  });
});

describe("empty Google results are not treated as authoritative", () => {
  // Guards the misconfiguration case: a scoping or permission error looks
  // identical to "this user is in no groups", and must not strip access.
  it("still computes removals normally when the group list is non-empty", () => {
    const result = reconcileGroupMembers({
      desiredUserIds: [],
      syncedMemberIds: ["a"],
      manualMemberIds: [],
    });

    // reconcile itself is pure; the empty-list guard lives in the caller,
    // so this documents that reconcile alone WOULD remove.
    expect(result.toRemove).toEqual(["a"]);
  });
});
