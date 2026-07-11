"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.simplifyTransform = simplifyTransform;
const transform_1 = require("@tiptap/pm/transform");
const getReplaceStep_1 = require("./getReplaceStep");
function simplifyTransform(tr) {
    if (!tr.steps.length) {
        return undefined;
    }
    const newTr = new transform_1.Transform(tr.docs[0]);
    const oldSteps = tr.steps.slice();
    while (oldSteps.length) {
        let step = oldSteps.shift();
        while (oldSteps.length && step.merge(oldSteps[0])) {
            const addedStep = oldSteps.shift();
            if (step instanceof transform_1.ReplaceStep && addedStep instanceof transform_1.ReplaceStep) {
                step = (0, getReplaceStep_1.getReplaceStep)(newTr.doc, addedStep.apply(step.apply(newTr.doc).doc).doc);
            }
            else {
                step = step.merge(addedStep);
            }
        }
        newTr.step(step);
    }
    return newTr;
}
//# sourceMappingURL=simplifyTransform.js.map