"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectTransclusionsFromPmJson = collectTransclusionsFromPmJson;
exports.collectReferencesFromPmJson = collectReferencesFromPmJson;
const TRANSCLUSION_TYPE = 'transclusionSource';
const REFERENCE_TYPE = 'transclusionReference';
function collectTransclusionsFromPmJson(doc) {
    if (!doc || typeof doc !== 'object')
        return [];
    const byId = new Map();
    const visit = (node) => {
        if (!node || typeof node !== 'object')
            return;
        if (node.type === TRANSCLUSION_TYPE) {
            const id = node.attrs?.id;
            if (typeof id === 'string' && id.length > 0) {
                byId.set(id, {
                    transclusionId: id,
                    content: { type: 'doc', content: node.content ?? [] },
                });
            }
            return;
        }
        if (Array.isArray(node.content)) {
            for (const child of node.content)
                visit(child);
        }
    };
    visit(doc);
    return Array.from(byId.values());
}
function collectReferencesFromPmJson(doc) {
    if (!doc || typeof doc !== 'object')
        return [];
    const seen = new Set();
    const out = [];
    const visit = (node) => {
        if (!node || typeof node !== 'object')
            return;
        if (node.type === REFERENCE_TYPE) {
            const sourcePageId = node.attrs?.sourcePageId;
            const transclusionId = node.attrs?.transclusionId;
            if (typeof sourcePageId === 'string' &&
                sourcePageId.length > 0 &&
                typeof transclusionId === 'string' &&
                transclusionId.length > 0) {
                const key = `${sourcePageId}::${transclusionId}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    out.push({ sourcePageId, transclusionId });
                }
            }
            return;
        }
        if (node.type === TRANSCLUSION_TYPE)
            return;
        if (Array.isArray(node.content)) {
            for (const child of node.content)
                visit(child);
        }
    };
    visit(doc);
    return out;
}
//# sourceMappingURL=transclusion-prosemirror.util.js.map