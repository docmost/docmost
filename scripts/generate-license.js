#!/usr/bin/env node
/**
 * Docmost License Key Generator
 * Usage: node scripts/generate-license.js [options]
 *
 * Options:
 *   --name    Customer name (default: "Demo User")
 *   --seats   Seat count   (default: 999)
 *   --years   Valid years  (default: 10)
 *   --trial   Trial license (flag)
 *
 * Example:
 *   node scripts/generate-license.js --name "Wilhelm-Raabe-Schule" --seats 200 --years 5
 */

const crypto = require('crypto');

const DEMO_LICENSE_SECRET = 'DOCMOST_DEMO_LICENSE_SECRET_KEY_2024';

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function signJwt(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `${header}.${body}.${sig}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { name: 'Demo User', seats: 999, years: 10, trial: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name' && args[i + 1]) result.name = args[++i];
    else if (args[i] === '--seats' && args[i + 1]) result.seats = parseInt(args[++i], 10);
    else if (args[i] === '--years' && args[i + 1]) result.years = parseInt(args[++i], 10);
    else if (args[i] === '--trial') result.trial = true;
  }

  return result;
}

const opts = parseArgs();

const now = new Date();
const expires = new Date(now);
expires.setFullYear(expires.getFullYear() + opts.years);

const payload = {
  id: `license-${Date.now()}`,
  customerName: opts.name,
  seatCount: opts.seats,
  issuedAt: now.toISOString(),
  expiresAt: expires.toISOString(),
  trial: opts.trial,
};

const licenseKey = signJwt(payload, DEMO_LICENSE_SECRET);

console.log('\n=== Docmost License Key ===');
console.log(`Customer : ${payload.customerName}`);
console.log(`Seats    : ${payload.seatCount}`);
console.log(`Issued   : ${now.toISOString().split('T')[0]}`);
console.log(`Expires  : ${expires.toISOString().split('T')[0]}`);
console.log(`Trial    : ${payload.trial}`);
console.log('\nKey:');
console.log(licenseKey);
console.log('');
