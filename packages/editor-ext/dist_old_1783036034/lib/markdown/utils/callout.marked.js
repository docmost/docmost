"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calloutExtension = void 0;
const marked_1 = require("marked");
exports.calloutExtension = {
    name: 'callout',
    level: 'block',
    start(src) {
        return src.match(/:::/)?.index ?? -1;
    },
    tokenizer(src) {
        const rule = /^:::([a-zA-Z0-9]+)\s+([\s\S]+?):::/;
        const match = rule.exec(src);
        const validCalloutTypes = ['info', 'success', 'warning', 'danger'];
        if (match) {
            let type = match[1];
            if (!validCalloutTypes.includes(type)) {
                type = 'info';
            }
            return {
                type: 'callout',
                calloutType: type,
                raw: match[0],
                text: match[2].trim(),
            };
        }
    },
    renderer(token) {
        const calloutToken = token;
        const body = marked_1.marked.parse(calloutToken.text);
        return `<div data-type="callout" data-callout-type="${calloutToken.calloutType}">${body}</div>`;
    },
};
//# sourceMappingURL=callout.marked.js.map