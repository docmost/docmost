import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { sanitize } from 'sanitize-filename-ts';
import { FastifyRequest } from 'fastify';
import { Readable, Transform } from 'stream';

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

export function hasLicenseOrEE(opts: {
  licenseKey: string;
  plan: string;
  isCloud: boolean;
}): boolean {
  const { licenseKey, plan, isCloud } = opts;
  return Boolean(licenseKey) || (isCloud && plan === 'business');
}

/**
 * Normalizes a database URL for postgres.js compatibility.
 * - Removes `sslmode=no-verify` (not supported by postgres.js), keeps other sslmode values
 * - Removes `schema` parameter (has no effect via connection string)
 * Note: If we don't strip them, the connection will fail
 */
export function normalizePostgresUrl(url: string): string {
  const parsed = new URL(url);
  const newParams = new URLSearchParams();

  for (const [key, value] of parsed.searchParams) {
    if (key === 'sslmode' && value === 'no-verify') continue;
    if (key === 'schema') continue;
    newParams.append(key, value);
  }

  parsed.search = newParams.toString();
  return parsed.toString();
}

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
