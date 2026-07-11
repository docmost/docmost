import { FastifyRequest } from 'fastify';
import { Readable, Transform } from 'stream';
export declare const envPath: string;
export declare function hashPassword(password: string): Promise<string>;
export declare function comparePasswordHash(plainPassword: string, passwordHash: string): Promise<boolean>;
export declare function generateRandomSuffixNumbers(length: number): string;
export type RedisConfig = {
    host: string;
    port: number;
    db: number;
    password?: string;
    family?: number;
};
export declare function parseRedisUrl(redisUrl: string): RedisConfig;
export declare function createRetryStrategy(): (times: number) => number;
export declare function extractDateFromUuid7(uuid7: string): Date;
export type SanitizeFileNameOptions = {
    preserveSpaces?: boolean;
};
export declare function sanitizeFileName(fileName: string, options?: SanitizeFileNameOptions): string;
export declare function removeAccent(str: string): string;
export declare function extractBearerTokenFromHeader(request: FastifyRequest): string | undefined;
export declare function normalizePostgresUrl(url: string): string;
export declare function diffAuditTrackedFields(fields: readonly string[], dto: Record<string, any>, before: Record<string, any> | undefined | null, after: Record<string, any> | undefined | null): {
    before: Record<string, any>;
    after: Record<string, any>;
} | null;
export declare function isUserDisabled(user: {
    deactivatedAt?: Date | null;
    deletedAt?: Date | null;
}): boolean;
export declare function redactSensitiveUrl(url: string): string;
export declare function createByteCountingStream(source: Readable): {
    stream: Transform;
    getBytesRead: () => number;
};
