import { stripPropertyFromViewConfig } from '../strip-property-from-view-config';

describe('stripPropertyFromViewConfig', () => {
  it('returns the config unchanged when no references exist', () => {
    const config = {
      sorts: [{ propertyId: 'p-other', direction: 'asc' as const }],
      filter: {
        op: 'and' as const,
        children: [{ propertyId: 'p-other', op: 'eq' as const, value: 1 }],
      },
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual(config);
  });

  it('drops sort entries pointing at the deleted property', () => {
    const config = {
      sorts: [
        { propertyId: 'p-deleted', direction: 'asc' as const },
        { propertyId: 'p-keep', direction: 'desc' as const },
      ],
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      sorts: [{ propertyId: 'p-keep', direction: 'desc' as const }],
    });
  });

  it('prunes filter clauses pointing at the deleted property', () => {
    const config = {
      filter: {
        op: 'and' as const,
        children: [
          { propertyId: 'p-deleted', op: 'eq' as const, value: 1 },
          { propertyId: 'p-keep', op: 'eq' as const, value: 2 },
        ],
      },
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      filter: {
        op: 'and' as const,
        children: [{ propertyId: 'p-keep', op: 'eq' as const, value: 2 }],
      },
    });
  });

  it('drops nested groups that become empty after pruning', () => {
    const config = {
      filter: {
        op: 'and' as const,
        children: [
          {
            op: 'or' as const,
            children: [{ propertyId: 'p-deleted', op: 'eq' as const, value: 1 }],
          },
          { propertyId: 'p-keep', op: 'eq' as const, value: 2 },
        ],
      },
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      filter: {
        op: 'and' as const,
        children: [{ propertyId: 'p-keep', op: 'eq' as const, value: 2 }],
      },
    });
  });

  it('clears kanban fields when groupByPropertyId matches', () => {
    const config = {
      groupByPropertyId: 'p-deleted',
      hiddenChoiceIds: ['c1'],
      choiceOrder: ['c1', 'c2'],
      sorts: [{ propertyId: 'p-keep', direction: 'asc' as const }],
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      sorts: [{ propertyId: 'p-keep', direction: 'asc' as const }],
    });
  });

  it('strips visiblePropertyIds entries pointing at the deleted property', () => {
    const config = {
      visiblePropertyIds: ['p-deleted', 'p-keep'],
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      visiblePropertyIds: ['p-keep'],
    });
  });

  it('strips hiddenPropertyIds entries pointing at the deleted property', () => {
    const config = {
      hiddenPropertyIds: ['p-deleted', 'p-keep'],
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      hiddenPropertyIds: ['p-keep'],
    });
  });

  it('strips propertyOrder entries pointing at the deleted property', () => {
    const config = {
      propertyOrder: ['p-other', 'p-deleted', 'p-keep'],
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      propertyOrder: ['p-other', 'p-keep'],
    });
  });

  it('removes propertyWidths entry for the deleted property', () => {
    const config = {
      propertyWidths: { 'p-deleted': 120, 'p-keep': 200 },
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      propertyWidths: { 'p-keep': 200 },
    });
  });

  it('removes the visiblePropertyIds/propertyWidths keys when they become empty', () => {
    const config = {
      visiblePropertyIds: ['p-deleted'],
      hiddenPropertyIds: ['p-deleted'],
      propertyOrder: ['p-deleted'],
      propertyWidths: { 'p-deleted': 120 },
      sorts: [{ propertyId: 'p-keep', direction: 'asc' as const }],
    };
    expect(stripPropertyFromViewConfig(config, 'p-deleted')).toEqual({
      sorts: [{ propertyId: 'p-keep', direction: 'asc' as const }],
    });
  });
});
