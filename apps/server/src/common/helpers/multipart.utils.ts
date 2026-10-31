import { pipeline, Readable, Transform } from 'stream';
import { MultipartFile } from '@fastify/multipart';

// Same status as the multipart plugin's size error, which upload routes turn into a 400
function fileTooLargeError(): Error {
  return Object.assign(new Error('request file too large'), {
    statusCode: 413,
  });
}

// A file cut off at the size limit fails the stream before it ends, so storage never commits it
export async function streamMultipartFile(
  file: MultipartFile,
  upload: (stream: Readable) => Promise<unknown>,
): Promise<number> {
  const source = file.file;
  let bytesRead = 0;

  const stream = new Transform({
    transform(chunk, encoding, callback) {
      bytesRead += chunk.length;
      callback(null, chunk);
    },
    flush(callback) {
      callback(source.truncated ? fileTooLargeError() : null);
    },
  });

  // Unlike pipe(), this also fails the stream when the client disconnects
  pipeline(source, stream, () => undefined);

  try {
    await upload(stream);
  } catch (err) {
    // Storage drivers wrap stream errors, which hides the status
    throw source.truncated ? fileTooLargeError() : err;
  }

  return bytesRead;
}

export async function bufferMultipartFile(file: MultipartFile): Promise<Buffer> {
  const buffer = await file.toBuffer();

  // toBuffer misses a limit that lands exactly on a chunk boundary
  if (file.file.truncated) {
    throw fileTooLargeError();
  }

  return buffer;
}
