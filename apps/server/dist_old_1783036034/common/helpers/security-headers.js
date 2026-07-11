"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFrameHeader = resolveFrameHeader;
function resolveFrameHeader(iframeEmbedAllowed, allowedOrigins) {
    if (!iframeEmbedAllowed) {
        return { name: 'X-Frame-Options', value: 'SAMEORIGIN' };
    }
    if (allowedOrigins.length === 0) {
        return null;
    }
    return {
        name: 'Content-Security-Policy',
        value: `frame-ancestors 'self' ${allowedOrigins.join(' ')}`,
    };
}
//# sourceMappingURL=security-headers.js.map