import { v7 as uuid7 } from 'uuid';
import {
  JOINED_WORKSPACES_LIMIT,
  moveJoinedWorkspaceToFront,
  parseJoinedWorkspaceIds,
} from './joined-workspaces.utils';

describe('parseJoinedWorkspaceIds', () => {
  it('keeps valid ids in cookie order', () => {
    const ids = [uuid7(), uuid7(), uuid7()];
    expect(parseJoinedWorkspaceIds(JSON.stringify(ids))).toEqual(ids);
  });

  it('drops entries that are not uuids', () => {
    const id = uuid7();
    expect(
      parseJoinedWorkspaceIds(JSON.stringify([null, 'abc', id, 42])),
    ).toEqual([id]);
  });

  it.each([undefined, '', 'not json', '{"a":1}', '"text"'])(
    'returns an empty list for %p',
    (cookie) => {
      expect(parseJoinedWorkspaceIds(cookie)).toEqual([]);
    },
  );
});

describe('moveJoinedWorkspaceToFront', () => {
  it('adds a new workspace at the front', () => {
    const [a, b, c] = [uuid7(), uuid7(), uuid7()];
    expect(moveJoinedWorkspaceToFront([a, b], c)).toEqual([c, a, b]);
  });

  it('moves an existing workspace to the front without duplicating it', () => {
    const [a, b, c] = [uuid7(), uuid7(), uuid7()];
    expect(moveJoinedWorkspaceToFront([a, b, c], c)).toEqual([c, a, b]);
  });

  it('keeps only the most recent workspaces', () => {
    const ids = Array.from({ length: JOINED_WORKSPACES_LIMIT }, () => uuid7());
    const current = uuid7();

    const result = moveJoinedWorkspaceToFront(ids, current);

    expect(result).toHaveLength(JOINED_WORKSPACES_LIMIT);
    expect(result[0]).toBe(current);
    expect(result).not.toContain(ids[ids.length - 1]);
  });
});
