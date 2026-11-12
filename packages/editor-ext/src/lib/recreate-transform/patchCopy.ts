import { applyPatch, Operation, Pointer } from "rfc6902";
import { AnyObject } from "./types";

// copy of json with the operation applied, sharing everything off its path
export function patchCopy(json: AnyObject, operation: Operation): AnyObject {
  const tokens = Pointer.fromJSON(operation.path).tokens;
  const root = shallowCopy(json);
  let parent = root;
  for (let i = 1; i < tokens.length - 1; i++) {
    const child = parent[tokens[i]];
    if (typeof child !== "object" || child === null) break;
    parent = parent[tokens[i]] = shallowCopy(child);
  }
  applyPatch(root, [operation]);
  return root;
}

function shallowCopy(value: any) {
  return Array.isArray(value) ? value.slice() : { ...value };
}
