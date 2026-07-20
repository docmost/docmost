import { PageVerificationRepo } from './page-verification.repo';

describe('PageVerificationRepo.flipStatusIfInApproval', () => {
  it('returns the updated row only when the current status is in_approval', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ id: 'pv-1', status: 'draft' });
    const chain: any = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      executeTakeFirst,
    };
    const db: any = { updateTable: jest.fn().mockReturnValue(chain) };
    const repo = new PageVerificationRepo(db);

    const result = await repo.flipStatusIfInApproval('pv-1', { status: 'draft' });

    expect(db.updateTable).toHaveBeenCalledWith('pageVerifications');
    expect(chain.where).toHaveBeenCalledWith('id', '=', 'pv-1');
    expect(chain.where).toHaveBeenCalledWith('status', '=', 'in_approval');
    expect(result).toEqual({ id: 'pv-1', status: 'draft' });
  });
});

// Regression coverage for Critical Finding 2: once a page can carry multiple
// page_verification rows (a retained `approved` audit row alongside a fresh
// `draft` cycle after content changes post-approval — design §3.1/§4),
// write methods scoped by bare `pageId` would silently mutate every row for
// that page, including the retained audit row. `update` must filter by the
// specific verification `id` instead.
describe('PageVerificationRepo.update', () => {
  it('scopes the update to the given verification id, not a bare pageId', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ id: 'pv-2', status: 'in_approval' });
    const chain: any = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returningAll: jest.fn().mockReturnThis(),
      executeTakeFirst,
    };
    const db: any = { updateTable: jest.fn().mockReturnValue(chain) };
    const repo = new PageVerificationRepo(db);

    await repo.update('pv-2', { status: 'in_approval' });

    expect(db.updateTable).toHaveBeenCalledWith('pageVerifications');
    expect(chain.where).toHaveBeenCalledWith('id', '=', 'pv-2');
    // Must never filter by pageId: that would match every historical row
    // for the page, including retained approved/obsolete audit rows.
    expect(chain.where).not.toHaveBeenCalledWith(
      'pageId',
      '=',
      expect.anything(),
    );
  });
});

describe('PageVerificationRepo.findDetailByPageId', () => {
  it('orders by createdAt desc so the latest cycle is returned deterministically', async () => {
    const executeTakeFirst = jest.fn().mockResolvedValue({ id: 'pv-latest' });
    const chain: any = {
      selectAll: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      executeTakeFirst,
    };
    const db: any = { selectFrom: jest.fn().mockReturnValue(chain) };
    const repo = new PageVerificationRepo(db);

    const result = await repo.findDetailByPageId('page-1');

    expect(chain.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(result).toEqual({ id: 'pv-latest' });
  });
});
