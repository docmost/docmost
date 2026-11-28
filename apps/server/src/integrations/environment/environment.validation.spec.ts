import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment.validation';

const errorsFor = (property: string, env: Record<string, string>) =>
  validateSync(plainToInstance(EnvironmentVariables, env)).filter(
    (error) => error.property === property,
  );

describe('EnvironmentVariables', () => {
  describe('IFRAMELY_URL', () => {
    it('rejects an address without a protocol for the Iframely driver', () => {
      expect(
        errorsFor('IFRAMELY_URL', {
          LINK_PREVIEW_DRIVER: 'iframely',
          IFRAMELY_URL: 'iframe.ly/api',
        }),
      ).toHaveLength(1);
    });

    it.each(['http://iframely:8061/', 'https://iframe.ly/api'])(
      'accepts %s',
      (url) => {
        expect(
          errorsFor('IFRAMELY_URL', {
            LINK_PREVIEW_DRIVER: 'iframely',
            IFRAMELY_URL: url,
          }),
        ).toEqual([]);
      },
    );

    it('is not checked without the Iframely driver', () => {
      expect(
        errorsFor('IFRAMELY_URL', { IFRAMELY_URL: 'iframe.ly/api' }),
      ).toEqual([]);
    });
  });
});
