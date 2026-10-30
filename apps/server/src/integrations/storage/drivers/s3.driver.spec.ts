import { S3Driver } from './s3.driver';

describe('S3Driver.copy', () => {
  const driver = new S3Driver({
    region: 'us-east-1',
    endpoint: 'https://s3.example.com',
    bucket: 'docmost',
  });
  const send = jest.fn().mockResolvedValue({});
  driver.getDriver().send = send;

  it.each([
    ['ws/files/id/image.png', 'ws/files/id/image.png'],
    [
      'ws/files/id/스크린샷.png',
      'ws/files/id/%EC%8A%A4%ED%81%AC%EB%A6%B0%EC%83%B7.png',
    ],
    ['ws/files/id/café.png', 'ws/files/id/caf%C3%A9.png'],
    ['ws/files/id/a+b%.png', 'ws/files/id/a%2Bb%25.png'],
  ])('encodes %j as %j', async (filePath, encodedPath) => {
    await driver.copy(filePath, 'ws/files/new/image.png');

    expect(send.mock.lastCall[0].input.CopySource).toBe(
      `docmost/${encodedPath}`,
    );
  });

  it('leaves the destination key unencoded', async () => {
    await driver.copy('ws/files/id/image.png', 'ws/files/new/스크린샷.png');

    expect(send.mock.lastCall[0].input.Key).toBe('ws/files/new/스크린샷.png');
  });
});
