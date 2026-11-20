import { Readable } from 'stream';
import { BlockBlobClient } from '@azure/storage-blob';
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

describe('AzureDriver.upload with a stream', () => {
  const FILE_PATH = 'ws/files/id/file.pdf';
  const driver = new AzureDriver({
    accountName: 'account',
    accountKey: Buffer.from('key').toString('base64'),
    container: 'docmost',
  });

  let stageBlock: jest.SpyInstance;
  let commitBlockList: jest.SpyInstance;

  beforeEach(() => {
    stageBlock = jest
      .spyOn(BlockBlobClient.prototype, 'stageBlock')
      .mockResolvedValue({} as any);
    commitBlockList = jest
      .spyOn(BlockBlobClient.prototype, 'commitBlockList')
      .mockResolvedValue({ _response: { status: 201 } } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('commits a stream that ends cleanly', async () => {
    await driver.upload(FILE_PATH, Readable.from([Buffer.alloc(1024)]));

    expect(stageBlock).toHaveBeenCalledTimes(1);
    expect(commitBlockList).toHaveBeenCalledTimes(1);
  });

  it('commits nothing when the stream fails', async () => {
    const stream = Readable.from(
      (async function* () {
        yield Buffer.alloc(1024);
        throw new Error('stream failed');
      })(),
    );

    await expect(driver.upload(FILE_PATH, stream)).rejects.toThrow(
      'Failed to upload file: stream failed',
    );

    expect(commitBlockList).not.toHaveBeenCalled();
  });
});
