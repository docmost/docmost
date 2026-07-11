"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamToBuffer = streamToBuffer;
function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        readableStream.on('data', (chunk) => chunks.push(chunk));
        readableStream.on('end', () => resolve(Buffer.concat(chunks)));
        readableStream.on('error', reject);
    });
}
//# sourceMappingURL=storage.utils.js.map