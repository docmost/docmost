import { UserService } from './user.service';

describe('UserService.update', () => {
  const workspace = { id: 'w1' } as any;
  let userRepo: { findById: jest.Mock; updateUser: jest.Mock };
  let auditService: { log: jest.Mock };
  let service: UserService;

  beforeEach(() => {
    userRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'u1',
        name: 'Ada',
        email: 'a@x.io',
        locale: 'en-US',
      }),
      updateUser: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { log: jest.fn() };
    service = new UserService(userRepo as any, auditService as any);
  });

  it('stores the time zone without auditing', async () => {
    const result = await service.update(
      { timezone: 'Europe/Berlin' } as any,
      'u1',
      workspace,
    );

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: 'Europe/Berlin' }),
      'u1',
      'w1',
    );
    expect(result).toEqual(expect.objectContaining({ timezone: 'Europe/Berlin' }));
    expect(auditService.log).not.toHaveBeenCalled();
  });
});
