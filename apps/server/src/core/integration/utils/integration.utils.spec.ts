import { toProviderAccount } from './integration.utils';

describe('toProviderAccount', () => {
  it('stringifies a numeric id and keeps the names', () => {
    expect(
      toProviderAccount({
        id: 583231,
        displayName: 'Philip Okugbe',
        username: 'Philipinho',
      }),
    ).toEqual({
      id: '583231',
      displayName: 'Philip Okugbe',
      username: 'Philipinho',
    });
  });

  it('leaves out names the provider did not return or left blank', () => {
    expect(
      toProviderAccount({ id: 'U-1', displayName: '  ', username: null }),
    ).toEqual({ id: 'U-1' });
  });

  it.each([undefined, null, '', {}])(
    'refuses a profile without an id (%p)',
    (id) => {
      expect(() => toProviderAccount({ id })).toThrow(
        'Provider profile has no account id',
      );
    },
  );
});
