"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mathInlineExtension = void 0;
const marked_1 = require("marked");
const inlineMathRegex = /^\$(?!\s)(.+?)(?<!\s)\$(?!\d)/;
exports.mathInlineExtension = {
    name: 'mathInline',
    level: 'inline',
    start(src) {
        let index;
        let indexSrc = src;
        while (indexSrc) {
            index = indexSrc.indexOf('$');
            if (index === -1) {
                return;
            }
            const f = index === 0 || indexSrc.charAt(index - 1) === ' ';
            if (f) {
                const possibleKatex = indexSrc.substring(index);
                if (possibleKatex.match(inlineMathRegex)) {
                    return index;
                }
            }
            indexSrc = indexSrc.substring(index + 1).replace(/^\$+/, '');
        }
    },
    tokenizer(src) {
        const match = inlineMathRegex.exec(src);
        if (match) {
            return {
                type: 'mathInline',
                raw: match[0],
                text: match[1]?.trim(),
            };
        }
    },
    renderer(token) {
        const mathInlineToken = token;
        const latex = marked_1.marked
            .parse(mathInlineToken.text)
            .toString()
            .replace(/<(\/)?p>/g, '');
        return `<span data-type="${mathInlineToken.type}" data-katex="true">${latex}</span>`;
    },
};
//# sourceMappingURL=math-inline.marked.js.map