"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJSON = generateJSON;
const core_1 = require("@tiptap/core");
const model_1 = require("@tiptap/pm/model");
const happy_dom_1 = require("happy-dom");
function generateJSON(html, extensions, options) {
    if (typeof window !== 'undefined') {
        throw new Error('generateJSON can only be used in a Node environment\nIf you want to use this in a browser environment, use the `@tiptap/html` import instead.');
    }
    const localWindow = new happy_dom_1.Window();
    const localDOMParser = new localWindow.DOMParser();
    let result;
    try {
        const schema = (0, core_1.getSchema)(extensions);
        let doc = null;
        const htmlString = `<!DOCTYPE html><html><body>${html}</body></html>`;
        doc = localDOMParser.parseFromString(htmlString, 'text/html');
        if (!doc) {
            throw new Error('Failed to parse HTML string');
        }
        result = model_1.DOMParser.fromSchema(schema)
            .parse(doc.body, options)
            .toJSON();
    }
    finally {
        localWindow.happyDOM.abort();
        localWindow.happyDOM.close();
    }
    return result;
}
//# sourceMappingURL=generateJSON.js.map