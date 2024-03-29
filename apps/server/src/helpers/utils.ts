import * as path from 'path';
import * as bcrypt from 'bcrypt';

export const envPath = path.resolve(process.cwd(), '..', '..', '.env');

export function generateHostname(name: string): string {
  let hostname = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  hostname = hostname.substring(0, 30);
  return hostname;
}

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

export function getRandomInt(min = 4, max = 5) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
