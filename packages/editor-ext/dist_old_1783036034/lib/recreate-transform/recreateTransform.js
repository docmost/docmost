"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecreateTransform = void 0;
exports.recreateTransform = recreateTransform;
const transform_1 = require("@tiptap/pm/transform");
const rfc6902_1 = require("rfc6902");
const diff_1 = require("diff");
const getReplaceStep_1 = require("./getReplaceStep");
const simplifyTransform_1 = require("./simplifyTransform");
const removeMarks_1 = require("./removeMarks");
const getFromPath_1 = require("./getFromPath");
const copy_1 = require("./copy");
class RecreateTransform {
    fromDoc;
    toDoc;
    complexSteps;
    wordDiffs;
    simplifyDiff;
    schema;
    tr;
    currentJSON;
    finalJSON;
    ops;
    constructor(fromDoc, toDoc, options = {}) {
        const o = {
            complexSteps: true,
            wordDiffs: false,
            simplifyDiff: true,
            ...options,
        };
        this.fromDoc = fromDoc;
        this.toDoc = toDoc;
        this.complexSteps = o.complexSteps;
        this.wordDiffs = o.wordDiffs;
        this.simplifyDiff = o.simplifyDiff;
        this.schema = fromDoc.type.schema;
        this.tr = new transform_1.Transform(fromDoc);
    }
    init() {
        if (this.complexSteps) {
            this.currentJSON = (0, removeMarks_1.removeMarks)(this.fromDoc).toJSON();
            this.finalJSON = (0, removeMarks_1.removeMarks)(this.toDoc).toJSON();
            this.ops = (0, rfc6902_1.createPatch)(this.currentJSON, this.finalJSON);
            this.recreateChangeContentSteps();
            this.recreateChangeMarkSteps();
        }
        else {
            this.currentJSON = this.fromDoc.toJSON();
            this.finalJSON = this.toDoc.toJSON();
            this.ops = (0, rfc6902_1.createPatch)(this.currentJSON, this.finalJSON);
            this.recreateChangeContentSteps();
        }
        if (this.simplifyDiff) {
            this.tr = (0, simplifyTransform_1.simplifyTransform)(this.tr) || this.tr;
        }
        return this.tr;
    }
    recreateChangeContentSteps() {
        let ops = [];
        while (this.ops.length) {
            let op = this.ops.shift();
            ops.push(op);
            let toDoc;
            const afterStepJSON = (0, copy_1.copy)(this.currentJSON);
            const pathParts = op.path.split("/");
            while (toDoc == null) {
                (0, rfc6902_1.applyPatch)(afterStepJSON, [op]);
                try {
                    toDoc = this.schema.nodeFromJSON(afterStepJSON);
                    toDoc.check();
                }
                catch (error) {
                    toDoc = null;
                    if (this.ops.length > 0) {
                        op = this.ops.shift();
                        ops.push(op);
                    }
                    else {
                        throw new Error(`No valid diff possible applying ${op.path}`);
                    }
                }
            }
            if (this.complexSteps &&
                ops.length === 1 &&
                (pathParts.includes("attrs") || pathParts.includes("type"))) {
                this.addSetNodeMarkup();
                ops = [];
            }
            else if (ops.length === 1 &&
                op.op === "replace" &&
                pathParts[pathParts.length - 1] === "text") {
                this.addReplaceTextSteps(op, afterStepJSON);
                ops = [];
            }
            else if (this.addReplaceStep(toDoc, afterStepJSON)) {
                ops = [];
            }
        }
    }
    addSetNodeMarkup() {
        const fromDoc = this.schema.nodeFromJSON(this.currentJSON);
        const toDoc = this.schema.nodeFromJSON(this.finalJSON);
        const start = toDoc.content.findDiffStart(fromDoc.content);
        const fromNode = fromDoc.nodeAt(start);
        const toNode = toDoc.nodeAt(start);
        if (start != null) {
            const nodeType = fromNode.type === toNode.type ? null : toNode.type;
            try {
                this.tr.setNodeMarkup(start, nodeType, toNode.attrs, toNode.marks);
            }
            catch (e) {
                if (nodeType && e.message.includes("Invalid content")) {
                    this.tr.replaceWith(start, start + fromNode.nodeSize, toNode);
                }
                else {
                    throw e;
                }
            }
            this.currentJSON = (0, removeMarks_1.removeMarks)(this.tr.doc).toJSON();
            this.ops = (0, rfc6902_1.createPatch)(this.currentJSON, this.finalJSON);
            return true;
        }
        return false;
    }
    recreateChangeMarkSteps() {
        this.toDoc.descendants((tNode, tPos) => {
            if (!tNode.isInline) {
                return true;
            }
            this.tr.doc.nodesBetween(tPos, tPos + tNode.nodeSize, (fNode, fPos) => {
                if (!fNode.isInline) {
                    return true;
                }
                const from = Math.max(tPos, fPos);
                const to = Math.min(tPos + tNode.nodeSize, fPos + fNode.nodeSize);
                fNode.marks.forEach((nodeMark) => {
                    if (!nodeMark.isInSet(tNode.marks)) {
                        this.tr.removeMark(from, to, nodeMark);
                    }
                });
                tNode.marks.forEach((nodeMark) => {
                    if (!nodeMark.isInSet(fNode.marks)) {
                        this.tr.addMark(from, to, nodeMark);
                    }
                });
            });
        });
    }
    addReplaceStep(toDoc, afterStepJSON) {
        const fromDoc = this.schema.nodeFromJSON(this.currentJSON);
        const step = (0, getReplaceStep_1.getReplaceStep)(fromDoc, toDoc);
        if (!step) {
            return false;
        }
        else if (!this.tr.maybeStep(step).failed) {
            this.currentJSON = afterStepJSON;
            return true;
        }
        throw new Error("No valid step found.");
    }
    addReplaceTextSteps(op, afterStepJSON) {
        const op1 = { ...op, value: "xx" };
        const op2 = { ...op, value: "yy" };
        const afterOP1JSON = (0, copy_1.copy)(this.currentJSON);
        const afterOP2JSON = (0, copy_1.copy)(this.currentJSON);
        (0, rfc6902_1.applyPatch)(afterOP1JSON, [op1]);
        (0, rfc6902_1.applyPatch)(afterOP2JSON, [op2]);
        const op1Doc = this.schema.nodeFromJSON(afterOP1JSON);
        const op2Doc = this.schema.nodeFromJSON(afterOP2JSON);
        const finalText = op.value;
        const currentText = (0, getFromPath_1.getFromPath)(this.currentJSON, op.path);
        const textDiffs = this.wordDiffs
            ? (0, diff_1.diffWordsWithSpace)(currentText, finalText)
            : (0, diff_1.diffChars)(currentText, finalText);
        let offset = op1Doc.content.findDiffStart(op2Doc.content);
        const marks = op1Doc.resolve(offset + 1).marks();
        while (textDiffs.length) {
            const diff = textDiffs.shift();
            if (diff.added) {
                const textNode = this.schema
                    .nodeFromJSON({ type: "text", text: diff.value })
                    .mark(marks);
                if (textDiffs.length && textDiffs[0].removed) {
                    const nextDiff = textDiffs.shift();
                    this.tr.replaceWith(offset, offset + nextDiff.value.length, textNode);
                }
                else {
                    this.tr.insert(offset, textNode);
                }
                offset += diff.value.length;
            }
            else if (diff.removed) {
                if (textDiffs.length && textDiffs[0].added) {
                    const nextDiff = textDiffs.shift();
                    const textNode = this.schema
                        .nodeFromJSON({ type: "text", text: nextDiff.value })
                        .mark(marks);
                    this.tr.replaceWith(offset, offset + diff.value.length, textNode);
                    offset += nextDiff.value.length;
                }
                else {
                    this.tr.delete(offset, offset + diff.value.length);
                }
            }
            else {
                offset += diff.value.length;
            }
        }
        this.currentJSON = afterStepJSON;
    }
}
exports.RecreateTransform = RecreateTransform;
function recreateTransform(fromDoc, toDoc, options = {}) {
    const recreator = new RecreateTransform(fromDoc, toDoc, options);
    return recreator.init();
}
//# sourceMappingURL=recreateTransform.js.map