import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { sanitize } from 'sanitize-filename-ts';
import { FastifyRequest } from 'fastify';

export const envPath = path.resolve(process.cwd(), '..', '..', '.env');

export async function hashPassword(password: string) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function comparePasswordHash(
  plainPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

export function generateRandomSuffixNumbers(length: number) {
  return Math.random()
    .toFixed(length)
    .substring(2, 2 + length);
}

export type RedisConfig = {
  host: string;
  port: number;
  db: number;
  password?: string;
  family?: number;
};

export function parseRedisUrl(redisUrl: string): RedisConfig {
  // format - redis[s]://[[username][:password]@][host][:port][/db-number][?family=4|6]
  const url = new URL(redisUrl);
  const { hostname, port, password, pathname, searchParams } = url;
  const portInt = parseInt(port, 10);

  let db: number = 0;
  // extract db value if present
  if (pathname.length > 1) {
    const value = pathname.slice(1);
    if (!isNaN(parseInt(value))) {
      db = parseInt(value, 10);
    }
  }

  // extract family from query parameters
  let family: number | undefined;
  const familyParam = searchParams.get('family');
  if (familyParam && !isNaN(parseInt(familyParam))) {
    family = parseInt(familyParam, 10);
  }

  return { host: hostname, port: portInt, password, db, family };
}

export function createRetryStrategy() {
  return function (times: number): number {
    return Math.max(Math.min(Math.exp(times), 20000), 3000);
  };
}

export function extractDateFromUuid7(uuid7: string) {
  //https://park.is/blog_posts/20240803_extracting_timestamp_from_uuid_v7/
  const parts = uuid7.split('-');
  const highBitsHex = parts[0] + parts[1].slice(0, 4);
  const timestamp = parseInt(highBitsHex, 16);

  return new Date(timestamp);
}

export function sanitizeFileName(fileName: string): string {
  const sanitizedFilename = sanitize(fileName)
    .replace(/ /g, '_')
    .replace(/#/g, '_');
  return sanitizedFilename.slice(0, 255);
}

export function removeAccent(str: string): string {
  if (!str) return str;
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function extractBearerTokenFromHeader(
  request: FastifyRequest,
): string | undefined {
  const [type, token] = request.headers.authorization?.split(' ') ?? [];
  return type === 'Bearer' ? token : undefined;
}

/**
 * Determines if a license is present or the deployment qualifies for enterprise edition.
 *
 * @param opts.licenseKey - The license key string; a non-empty value indicates a license is present.
 * @param opts.plan - The subscription plan name; `'business'` qualifies as enterprise when running in cloud.
 * @param opts.isCloud - Whether the instance is running in a cloud environment.
 * @returns `true` if a license is present or the instance is cloud-hosted with the `'business'` plan, `false` otherwise.
 */
export function hasLicenseOrEE(opts: {
  licenseKey: string;
  plan: string;
  isCloud: boolean;
}): boolean {
  const { licenseKey, plan, isCloud } = opts;
  return Boolean(licenseKey) || (isCloud && plan === 'business');
}

import { Readable, Transform } from 'stream';

/**
 * Wraps a Readable stream with a Transform that counts bytes passing through.
 *
 * @param source - The source Readable to pipe into the counting Transform; source errors are forwarded to the returned stream.
 * @returns An object with `stream`, the Transform that re-emits the original data, and `getBytesRead()` which returns the total number of bytes that have passed through the stream.
 */
export function createByteCountingStream(source: Readable) {
  let bytesRead = 0;
  const stream = new Transform({
    transform(chunk, encoding, callback) {
      bytesRead += chunk.length;
      callback(null, chunk);
    },
  });

  source.pipe(stream);
  source.on('error', (err) => stream.emit('error', err));

  return { stream, getBytesRead: () => bytesRead };
}