import { Transform, ReplaceStep, Step } from "@tiptap/pm/transform";
import { getReplaceStep } from "./getReplaceStep";

// join adjacent ReplaceSteps
export function simplifyTransform(tr: Transform) {
  if (!tr.steps.length) {
    return undefined;
  }

  const newTr = new Transform(tr.docs[0]);
  const oldSteps = tr.steps.slice();

  while (oldSteps.length) {
    let step = oldSteps.shift();
    while (oldSteps.length && step.merge(oldSteps[0])) {
      const addedStep = oldSteps.shift();
      if (step instanceof ReplaceStep && addedStep instanceof ReplaceStep) {
        step = getReplaceStep(
          newTr.doc,
          addedStep.apply(step.apply(newTr.doc).doc).doc,
          // @ts-ignore
        ) as Step<any>;
      } else {
        step = step.merge(addedStep);
      }
    }
    newTr.step(step);
  }
  return newTr;
}
