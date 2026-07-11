"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.envPath = void 0;
exports.hashPassword = hashPassword;
exports.comparePasswordHash = comparePasswordHash;
exports.generateRandomSuffixNumbers = generateRandomSuffixNumbers;
exports.parseRedisUrl = parseRedisUrl;
exports.createRetryStrategy = createRetryStrategy;
exports.extractDateFromUuid7 = extractDateFromUuid7;
exports.sanitizeFileName = sanitizeFileName;
exports.removeAccent = removeAccent;
exports.extractBearerTokenFromHeader = extractBearerTokenFromHeader;
exports.normalizePostgresUrl = normalizePostgresUrl;
exports.diffAuditTrackedFields = diffAuditTrackedFields;
exports.isUserDisabled = isUserDisabled;
exports.redactSensitiveUrl = redactSensitiveUrl;
exports.createByteCountingStream = createByteCountingStream;
const path = require("path");
const bcrypt = require("bcrypt");
const sanitize = require("sanitize-filename");
const stream_1 = require("stream");
exports.envPath = path.resolve(process.cwd(), '..', '..', '.env');
async function hashPassword(password) {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
}
async function comparePasswordHash(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
}
function generateRandomSuffixNumbers(length) {
    return Math.random()
        .toFixed(length)
        .substring(2, 2 + length);
}
function parseRedisUrl(redisUrl) {
    const url = new URL(redisUrl);
    const { hostname, port, password, pathname, searchParams } = url;
    const portInt = parseInt(port, 10);
    let db = 0;
    if (pathname.length > 1) {
        const value = pathname.slice(1);
        if (!isNaN(parseInt(value))) {
            db = parseInt(value, 10);
        }
    }
    let family;
    const familyParam = searchParams.get('family');
    if (familyParam && !isNaN(parseInt(familyParam))) {
        family = parseInt(familyParam, 10);
    }
    return { host: hostname, port: portInt, password, db, family };
}
function createRetryStrategy() {
    return function (times) {
        return Math.max(Math.min(Math.exp(times), 20000), 3000);
    };
}
function extractDateFromUuid7(uuid7) {
    const parts = uuid7.split('-');
    const highBitsHex = parts[0] + parts[1].slice(0, 4);
    const timestamp = parseInt(highBitsHex, 16);
    return new Date(timestamp);
}
function sanitizeFileName(fileName, options = {}) {
    const decoded = fileName.replace(/%[0-9a-fA-F]{2}/g, (m) => {
        try {
            return decodeURIComponent(m);
        }
        catch {
            return m;
        }
    });
    const sanitized = sanitize(decoded);
    if (options.preserveSpaces) {
        return sanitized;
    }
    return sanitized.replace(/ /g, '_').replace(/#/g, '_');
}
function removeAccent(str) {
    if (!str)
        return str;
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function extractBearerTokenFromHeader(request) {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type?.toLowerCase() === 'bearer' ? token : undefined;
}
function normalizePostgresUrl(url) {
    const parsed = new URL(url);
    const newParams = new URLSearchParams();
    for (const [key, value] of parsed.searchParams) {
        if (key === 'sslmode' && value === 'no-verify')
            continue;
        if (key === 'schema')
            continue;
        newParams.append(key, value);
    }
    parsed.search = newParams.toString();
    return parsed.toString();
}
function diffAuditTrackedFields(fields, dto, before, after) {
    const beforeDiff = {};
    const afterDiff = {};
    let hasChanges = false;
    for (const field of fields) {
        if (typeof dto[field] === 'undefined')
            continue;
        const oldVal = JSON.stringify(before?.[field] ?? null);
        const newVal = JSON.stringify(after?.[field] ?? null);
        if (oldVal !== newVal) {
            beforeDiff[field] = before?.[field];
            afterDiff[field] = after?.[field];
            hasChanges = true;
        }
    }
    return hasChanges ? { before: beforeDiff, after: afterDiff } : null;
}
function isUserDisabled(user) {
    return !!(user.deactivatedAt || user.deletedAt);
}
const SENSITIVE_URL_PREFIXES = ['/api/sso/'];
function redactSensitiveUrl(url) {
    if (url && SENSITIVE_URL_PREFIXES.some((prefix) => url.includes(prefix))) {
        const qsIndex = url.indexOf('?');
        if (qsIndex !== -1) {
            return url.substring(0, qsIndex);
        }
    }
    return url;
}
function createByteCountingStream(source) {
    let bytesRead = 0;
    const stream = new stream_1.Transform({
        transform(chunk, encoding, callback) {
            bytesRead += chunk.length;
            callback(null, chunk);
        },
    });
    source.pipe(stream);
    source.on('error', (err) => stream.emit('error', err));
    return { stream, getBytesRead: () => bytesRead };
}
//# sourceMappingURL=utils.js.map