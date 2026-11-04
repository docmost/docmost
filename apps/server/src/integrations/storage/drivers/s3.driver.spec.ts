import { Readable } from 'stream';
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

describe('S3Driver.upload with a stream', () => {
  const FILE_PATH = 'ws/files/id/file.pdf';
  const PART_SIZE = 5 * 1024 * 1024;

  const driver = new S3Driver({
    region: 'us-east-1',
    endpoint: 'https://s3.example.com',
    bucket: 'docmost',
  });

  const sent = () => send.mock.calls.map(([command]) => command.constructor.name);
  const send = jest.fn(async (command: any) => {
    switch (command.constructor.name) {
      case 'CreateMultipartUploadCommand':
        return { UploadId: 'upload-id' };
      case 'UploadPartCommand':
        return { ETag: `etag-${command.input.PartNumber}` };
      default:
        return {};
    }
  });

  // yields the bytes, then fails in place of the end of the stream
  const failingStream = (size: number) =>
    Readable.from(
      (async function* () {
        yield Buffer.alloc(size);
        throw new Error('stream failed');
      })(),
    );

  beforeEach(() => {
    send.mockClear();
    driver.getDriver().send = send as any;
  });

  it('puts a stream that ends cleanly', async () => {
    await driver.upload(FILE_PATH, Readable.from([Buffer.alloc(1024)]));

    expect(sent()).toEqual(['PutObjectCommand']);
  });

  it('writes nothing when a stream below the part size fails', async () => {
    await expect(driver.upload(FILE_PATH, failingStream(1024))).rejects.toThrow(
      'Failed to upload file: stream failed',
    );

    expect(sent()).toEqual([]);
  });

  it('aborts the multipart upload when a larger stream fails', async () => {
    await expect(
      driver.upload(FILE_PATH, failingStream(PART_SIZE + 1024)),
    ).rejects.toThrow('Failed to upload file: stream failed');

    expect(sent()).toEqual([
      'CreateMultipartUploadCommand',
      'UploadPartCommand',
      'AbortMultipartUploadCommand',
    ]);
  });
});
