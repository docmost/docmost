"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlUnescape = exports.htmlEscape = void 0;
const { replace } = '';
const es = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g;
const ca = /[&<>'"]/g;
const esca = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
};
const pe = (m) => esca[m];
const htmlEscape = (es) => replace.call(es, ca, pe);
exports.htmlEscape = htmlEscape;
const unes = {
    '&amp;': '&',
    '&#38;': '&',
    '&lt;': '<',
    '&#60;': '<',
    '&gt;': '>',
    '&#62;': '>',
    '&apos;': "'",
    '&#39;': "'",
    '&quot;': '"',
    '&#34;': '"',
};
const cape = (m) => unes[m];
const htmlUnescape = (un) => replace.call(un, es, cape);
exports.htmlUnescape = htmlUnescape;
//# sourceMappingURL=html-escaper.js.map