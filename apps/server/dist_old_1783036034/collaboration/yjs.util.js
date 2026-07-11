"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setYjsMark = setYjsMark;
exports.removeYjsMarkByAttribute = removeYjsMarkByAttribute;
exports.updateYjsMarkAttribute = updateYjsMarkAttribute;
const y_tiptap_1 = require("@tiptap/y-tiptap");
const Y = require("yjs");
const core_1 = require("@tiptap/core");
const collaboration_util_1 = require("./collaboration.util");
function setYjsMark(doc, fragment, yjsSelection, markName, markAttributes) {
    const schema = (0, core_1.getSchema)(collaboration_util_1.tiptapExtensions);
    const { mapping } = (0, y_tiptap_1.initProseMirrorDoc)(fragment, schema);
    const anchorRelPos = Y.createRelativePositionFromJSON(yjsSelection.anchor);
    const headRelPos = Y.createRelativePositionFromJSON(yjsSelection.head);
    const anchor = (0, y_tiptap_1.relativePositionToAbsolutePosition)(doc, fragment, anchorRelPos, mapping);
    const head = (0, y_tiptap_1.relativePositionToAbsolutePosition)(doc, fragment, headRelPos, mapping);
    if (anchor === null || head === null) {
        throw new Error('Could not resolve Y.js relative positions to absolute positions');
    }
    const from = Math.min(anchor, head);
    const to = Math.max(anchor, head);
    applyMarkToYFragment(fragment, from, to, markName, markAttributes);
}
function applyMarkToYFragment(fragment, from, to, markName, markAttributes) {
    let pos = 0;
    const processItem = (item, parentNodeName) => {
        if (pos >= to)
            return false;
        if (item instanceof Y.XmlText) {
            const textLength = item.length;
            const itemEnd = pos + textLength;
            if (itemEnd > from && pos < to && parentNodeName !== 'codeBlock') {
                const formatFrom = Math.max(0, from - pos);
                const formatTo = Math.min(textLength, to - pos);
                const formatLength = formatTo - formatFrom;
                if (formatLength > 0) {
                    item.format(formatFrom, formatLength, { [markName]: markAttributes });
                }
            }
            pos = itemEnd;
        }
        else if (item instanceof Y.XmlElement) {
            pos++;
            for (let i = 0; i < item.length; i++) {
                if (!processItem(item.get(i), item.nodeName))
                    return false;
            }
            pos++;
        }
        return true;
    };
    for (let i = 0; i < fragment.length; i++) {
        if (!processItem(fragment.get(i)))
            break;
    }
}
function removeYjsMarkByAttribute(fragment, markName, attributeName, attributeValue) {
    const processItem = (item) => {
        if (item instanceof Y.XmlText) {
            const deltas = item.toDelta();
            let offset = 0;
            for (const delta of deltas) {
                const length = delta.insert?.length ?? 0;
                const attributes = delta.attributes ?? {};
                const markAttr = attributes[markName];
                if (markAttr && markAttr[attributeName] === attributeValue) {
                    item.format(offset, length, { [markName]: null });
                }
                offset += length;
            }
        }
        else if (item instanceof Y.XmlElement) {
            for (let i = 0; i < item.length; i++) {
                processItem(item.get(i));
            }
        }
    };
    for (let i = 0; i < fragment.length; i++) {
        processItem(fragment.get(i));
    }
}
function updateYjsMarkAttribute(fragment, markName, findByAttribute, newAttributes) {
    const processItem = (item) => {
        if (item instanceof Y.XmlText) {
            const deltas = item.toDelta();
            let offset = 0;
            for (const delta of deltas) {
                const length = delta.insert?.length ?? 0;
                const attributes = delta.attributes ?? {};
                const markAttr = attributes[markName];
                if (markAttr &&
                    markAttr[findByAttribute.name] === findByAttribute.value) {
                    item.format(offset, length, {
                        [markName]: { ...markAttr, ...newAttributes },
                    });
                }
                offset += length;
            }
        }
        else if (item instanceof Y.XmlElement) {
            for (let i = 0; i < item.length; i++) {
                processItem(item.get(i));
            }
        }
    };
    for (let i = 0; i < fragment.length; i++) {
        processItem(fragment.get(i));
    }
}
//# sourceMappingURL=yjs.util.js.map