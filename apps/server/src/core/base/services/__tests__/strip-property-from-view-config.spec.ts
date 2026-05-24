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
});
