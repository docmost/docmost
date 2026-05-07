import {
  collectReferencesFromPmJson,
  collectTransclusionsFromPmJson,
} from '../utils/transclusion-prosemirror.util';

describe('collectTransclusionsFromPmJson', () => {
  it('returns [] for null/undefined doc', () => {
    expect(collectTransclusionsFromPmJson(null)).toEqual([]);
    expect(collectTransclusionsFromPmJson(undefined)).toEqual([]);
  });

  it('returns [] for a doc with no transclusion nodes', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    };
    expect(collectTransclusionsFromPmJson(doc)).toEqual([]);
  });

  it('extracts a top-level transclusion with id and content', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'abc123' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
        },
      ],
    };
    const got = collectTransclusionsFromPmJson(doc);
    expect(got).toHaveLength(1);
    expect(got[0].transclusionId).toBe('abc123');
    expect(got[0].content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
    });
  });

  it('skips transclusion nodes with no id (transient before UniqueID assigns one)', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'transclusionSource', attrs: {}, content: [{ type: 'paragraph' }] },
      ],
    };
    expect(collectTransclusionsFromPmJson(doc)).toEqual([]);
  });

  it('returns multiple top-level transclusions', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'transclusionSource', attrs: { id: 'a' }, content: [{ type: 'paragraph' }] },
        { type: 'transclusionSource', attrs: { id: 'b' }, content: [{ type: 'paragraph' }] },
      ],
    };
    const got = collectTransclusionsFromPmJson(doc);
    expect(got.map((e) => e.transclusionId)).toEqual(['a', 'b']);
  });

  it('does not recurse into a nested transclusion (transclusion cannot contain transclusion per schema, but be defensive)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'outer' },
          content: [
            {
              type: 'transclusionSource',
              attrs: { id: 'inner' },
              content: [{ type: 'paragraph' }],
            },
          ],
        },
      ],
    };
    const got = collectTransclusionsFromPmJson(doc);
    expect(got.map((e) => e.transclusionId)).toEqual(['outer']);
  });

  it('finds transclusions nested inside other block containers (e.g. column)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'column',
          content: [
            { type: 'transclusionSource', attrs: { id: 'inCol' }, content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    };
    expect(collectTransclusionsFromPmJson(doc).map((e) => e.transclusionId)).toEqual([
      'inCol',
    ]);
  });

  it('uses the last id when duplicate ids appear (later wins, deterministic)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'dup' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'first' }] }],
        },
        {
          type: 'transclusionSource',
          attrs: { id: 'dup' },
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }],
        },
      ],
    };
    const got = collectTransclusionsFromPmJson(doc);
    expect(got).toHaveLength(1);
    expect(got[0].content).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'second' }] }],
    });
  });
});

describe('collectReferencesFromPmJson', () => {
  it('returns [] for null/undefined doc', () => {
    expect(collectReferencesFromPmJson(null)).toEqual([]);
    expect(collectReferencesFromPmJson(undefined)).toEqual([]);
  });

  it('returns [] for a doc with no transclusionReference nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hi' }] },
      ],
    };
    expect(collectReferencesFromPmJson(doc)).toEqual([]);
  });

  it('extracts a top-level reference', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
        },
      ],
    };
    expect(collectReferencesFromPmJson(doc)).toEqual([
      { sourcePageId: 'p1', transclusionId: 'e1' },
    ]);
  });

  it('skips references missing sourcePageId or transclusionId', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'transclusionReference', attrs: { transclusionId: 'e1' } },
        { type: 'transclusionReference', attrs: { sourcePageId: 'p1' } },
        { type: 'transclusionReference', attrs: {} },
      ],
    };
    expect(collectReferencesFromPmJson(doc)).toEqual([]);
  });

  it('finds references nested in other block containers (column, callout, etc.)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'column',
          content: [
            {
              type: 'transclusionReference',
              attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
            },
          ],
        },
        {
          type: 'callout',
          content: [
            {
              type: 'transclusionReference',
              attrs: { sourcePageId: 'p2', transclusionId: 'e2' },
            },
          ],
        },
      ],
    };
    expect(collectReferencesFromPmJson(doc)).toEqual([
      { sourcePageId: 'p1', transclusionId: 'e1' },
      { sourcePageId: 'p2', transclusionId: 'e2' },
    ]);
  });

  it('does not recurse into a transclusion source (schema forbids references inside)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'transclusionSource',
          attrs: { id: 'src1' },
          content: [
            {
              type: 'transclusionReference',
              attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
            },
          ],
        },
      ],
    };
    expect(collectReferencesFromPmJson(doc)).toEqual([]);
  });

  it('dedupes identical (sourcePageId, transclusionId) pairs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
        },
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p1', transclusionId: 'e1' },
        },
        {
          type: 'transclusionReference',
          attrs: { sourcePageId: 'p2', transclusionId: 'e2' },
        },
      ],
    };
    expect(collectReferencesFromPmJson(doc)).toEqual([
      { sourcePageId: 'p1', transclusionId: 'e1' },
      { sourcePageId: 'p2', transclusionId: 'e2' },
    ]);
  });
});
