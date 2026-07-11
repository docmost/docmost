"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHTMLFromFragment = getHTMLFromFragment;
const model_1 = require("@tiptap/pm/model");
const happy_dom_1 = require("happy-dom");
function getHTMLFromFragment(doc, schema, options) {
    if (options?.document) {
        const wrap = options.document.createElement('div');
        model_1.DOMSerializer.fromSchema(schema).serializeFragment(doc.content, { document: options.document }, wrap);
        return wrap.innerHTML;
    }
    const localWindow = new happy_dom_1.Window();
    let result;
    try {
        const fragment = model_1.DOMSerializer.fromSchema(schema).serializeFragment(doc.content, {
            document: localWindow.document,
        });
        const serializer = new localWindow.XMLSerializer();
        result = serializer.serializeToString(fragment);
    }
    finally {
        localWindow.happyDOM.abort();
        localWindow.happyDOM.close();
    }
    return result;
}
//# sourceMappingURL=getHTMLFromFragment.js.map