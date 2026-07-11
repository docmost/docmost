"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mathBlockExtension = void 0;
const marked_1 = require("marked");
exports.mathBlockExtension = {
    name: 'mathBlock',
    level: 'block',
    start(src) {
        return src.match(/\$\$/)?.index ?? -1;
    },
    tokenizer(src) {
        const rule = /^\$\$(?!(\$))([\s\S]+?)\$\$/;
        const match = rule.exec(src);
        if (match) {
            return {
                type: 'mathBlock',
                raw: match[0],
                text: match[2]?.trim(),
            };
        }
    },
    renderer(token) {
        const mathBlockToken = token;
        const latex = marked_1.marked
            .parse(mathBlockToken.text)
            .toString()
            .replace(/<(\/)?p>/g, '');
        return `<div data-type="${mathBlockToken.type}" data-katex="true">${latex}</div>`;
    },
};
//# sourceMappingURL=math-block.marked.js.map