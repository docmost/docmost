# prosemirror-recreate-transform

> reduced and modified fork of https://gitlab.com/mpapp-public/prosemirror-recreate-steps

This is a non-core module of [ProseMirror](http://prosemirror.net).
ProseMirror is a well-behaved rich semantic content editor based on
contentEditable, with support for collaborative editing and custom
document schemas.

Every change to the document is recorded by ProseMirror as a step.
This module allows recreating the steps needed to go from document
A to B should these not be available otherwise. Recreating steps
can be interesting for example in order to show the changes between
two document versions without having access to the original steps.

Recreating a `Transform` works this way:

```js
import { recreateTransform } from "@technik-sde/prosemirror-recreate-transform";

let tr = recreateTransform(
    startDoc, 
    endDoc, 
    {
        complexSteps: true, // Whether step types other than ReplaceStep are allowed.
        wordDiffs: false, // Whether diffs in text nodes should cover entire words.
        simplifyDiffs: true // Whether steps should be merged, where possible
    }
);
```
