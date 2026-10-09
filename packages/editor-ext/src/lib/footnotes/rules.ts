//Source MIT - https://github.com/buttondown/tiptap-footnotes
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ReplaceStep } from "@tiptap/pm/transform";
import { Extension } from "@tiptap/core";
import { updateFootnotesList } from "./utils";

const FootnoteRules = Extension.create({
  name: "footnoteRules",
  priority: 1000,
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("footnoteRules"),
        filterTransaction(tr) {
          const { from, to } = tr.selection;

          // Allow full document selections (Mod-a/Ctrl-a)
          if (from === 0 && to === tr.doc.content.size) return true;

          let selectedFootnotes = false;
          let selectedContent = false;
          let footnoteCount = 0;
          tr.doc.nodesBetween(from, to, (node, _, parent) => {
            if (parent?.type.name == "doc" && node.type.name != "footnotes") {
              selectedContent = true;
            } else if (node.type.name == "footnote") {
              footnoteCount += 1;
            } else if (node.type.name == "footnotes") {
              selectedFootnotes = true;
            }
          });
          const overSelected = selectedContent && selectedFootnotes;
          /*
           * Here, we don't allow any transaction that spans between the "content" nodes and the "footnotes" node. This also rejects any transaction that spans between more than 1 footnote.
           */
          return !overSelected && footnoteCount <= 1;
        },

        // if there are some to the footnote references (added/deleted/dragged), append a transaction that updates the footnotes list accordingly
        appendTransaction(transactions, oldState, newState) {
          let newTr = newState.tr;
          let refsChanged = false; // true if the footnote references have been changed, false otherwise
          for (let tr of transactions) {
            if (!tr.docChanged) continue;
            if (refsChanged) break;

            for (let step of tr.steps) {
              if (!(step instanceof ReplaceStep)) continue;
              if (refsChanged) break;

              const isDelete = step.from != step.to; // the user deleted items from the document (from != to & the step is a replace step)
              const isInsert = step.slice.size > 0;

              // check if any footnote references have been inserted
              if (isInsert) {
                step.slice.content.descendants((node) => {
                  if (node?.type.name == "footnoteReference") {
                    refsChanged = true;
                    return false;
                  }
                });
              }
              if (isDelete && !refsChanged) {
                // check if any footnote references have been deleted
                tr.before.nodesBetween(
                  step.from,
                  Math.min(tr.before.content.size, step.to), // make sure to not go over the old document's limit
                  (node) => {
                    if (node.type.name == "footnoteReference") {
                      refsChanged = true;
                      return false;
                    }
                  },
                );
              }
            }
          }

          if (refsChanged) {
            updateFootnotesList(newTr, newState);
            return newTr;
          }

          return null;
        },
      }),
    ];
  },
});
export default FootnoteRules;
