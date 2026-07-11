"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHTML = generateHTML;
const core_1 = require("@tiptap/core");
const model_1 = require("@tiptap/pm/model");
const getHTMLFromFragment_1 = require("./getHTMLFromFragment");
function generateHTML(doc, extensions) {
    if (typeof window !== 'undefined') {
        throw new Error('generateHTML can only be used in a Node environment\nIf you want to use this in a browser environment, use the `@tiptap/html` import instead.');
    }
    const schema = (0, core_1.getSchema)(extensions);
    const contentNode = model_1.Node.fromJSON(schema, doc);
    return (0, getHTMLFromFragment_1.getHTMLFromFragment)(contentNode, schema);
}
//# sourceMappingURL=generateHTML.js.map