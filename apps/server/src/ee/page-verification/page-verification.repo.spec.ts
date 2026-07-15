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
