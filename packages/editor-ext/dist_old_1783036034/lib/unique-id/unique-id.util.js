"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addUniqueIdsToDoc = addUniqueIdsToDoc;
const core_1 = require("@tiptap/core");
const model_1 = require("@tiptap/pm/model");
const state_1 = require("@tiptap/pm/state");
function addUniqueIdsToDoc(doc, extensions) {
    const uniqueIDExtension = extensions.find((ext) => ext.name === "uniqueID");
    if (!uniqueIDExtension) {
        throw new Error("UniqueID extension not found in the extensions array");
    }
    const { types, attributeName, generateID } = uniqueIDExtension.options;
    const schema = (0, core_1.getSchema)([
        ...extensions.filter((ext) => ext.name !== "uniqueID"),
        uniqueIDExtension,
    ]);
    const contentNode = model_1.Node.fromJSON(schema, doc);
    const nodesWithoutId = (0, core_1.findChildren)(contentNode, (node) => {
        return !node.attrs[attributeName] && types.includes(node.type.name);
    });
    let tr = state_1.EditorState.create({
        doc: contentNode,
    }).tr;
    for (const { node, pos } of nodesWithoutId) {
        tr = tr.setNodeAttribute(pos, attributeName, generateID({ node, pos }));
    }
    return tr.doc.toJSON();
}
//# sourceMappingURL=unique-id.util.js.map