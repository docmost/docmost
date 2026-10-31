import { AzureDriver } from './azure.driver';

describe('AzureDriver.getSignedUrl', () => {
  const driver = new AzureDriver({
    accountName: 'account',
    accountKey: Buffer.from('key').toString('base64'),
    container: 'docmost',
  });

  it.each([
    ['ws/files/id/image.png', 'ws/files/id/image.png'],
    [
      'ws/files/id/스크린샷.png',
      'ws/files/id/%EC%8A%A4%ED%81%AC%EB%A6%B0%EC%83%B7.png',
    ],
    ['ws/files/id/café.png', 'ws/files/id/caf%C3%A9.png'],
    ['ws/files/id/a+b%.png', 'ws/files/id/a%2Bb%25.png'],
  ])('encodes %j as %j', async (filePath, encodedPath) => {
    const url = await driver.getSignedUrl(filePath, 60);

    expect(url.split('?')[0]).toBe(
      `https://account.blob.core.windows.net/docmost/${encodedPath}`,
    );
  });

  it('keeps the SAS signature on the url', async () => {
    const url = await driver.getSignedUrl('ws/files/id/스크린샷.png', 60);

    expect(new URL(url).searchParams.get('sig')).toBeTruthy();
  });
});
