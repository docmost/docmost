import {
  Extension,
  findChildren,
  combineTransactionSteps,
  getChangedRanges,
  findChildrenInRange,
  findDuplicates,
} from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Slice, Fragment } from "@tiptap/pm/model";

export const BlockId = new Extension({
  name: "block-id",
  priority: 99999,

  addOptions: () => ({
    attributeName: "id",
    types: [],
    createId: () => window.crypto.randomUUID(),
  }),

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          [this.options.attributeName]: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute(this.options.attributeName),
            renderHTML: (attributes) =>
              attributes[this.options.attributeName]
                ? {
                    [this.options.attributeName]:
                      attributes[this.options.attributeName],
                  }
                : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    let dragContainer = null;
    let wasDropOrPaste = false;
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey("block-id"),

        appendTransaction: (transactions, oldState, newState) => {
          const { doc: oldDoc } = oldState;
          const { doc: newDoc, tr: transaction } = newState;

          if (!transactions.some((tr) => tr.docChanged) || oldDoc.eq(newDoc)) {
            return;
          }

          const { types, attributeName, createId } = options;
          const combinedSteps = combineTransactionSteps(oldDoc, [
            ...transactions,
          ]);

          for (const { newRange } of getChangedRanges(combinedSteps)) {
            const changedNodes = findChildrenInRange(newDoc, newRange, (node) =>
              types.includes(node.type.name),
            );

            const existingIds = changedNodes
              .map(({ node }) => node.attrs[attributeName])
              .filter((id) => id !== null);

            for (const { node, pos } of changedNodes) {
              const currentId =
                transaction.doc.nodeAt(pos)?.attrs[attributeName];

              if (currentId === null) {
                transaction.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  [attributeName]: createId(),
                });
                continue;
              }

              const previousPos = combinedSteps.mapping
                .invert()
                .mapResult(pos).pos;
              const previousNode = oldDoc.nodeAt(previousPos);

              if (
                findDuplicates(existingIds).includes(currentId) &&
                (!previousNode ||
                  previousNode.attrs[attributeName] !== currentId)
              ) {
                transaction.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  [attributeName]: createId(),
                });
              }
            }
          }

          return transaction.steps.length ? transaction : undefined;
        },

        view(editorView) {
          const onDragStart = (event) => {
            dragContainer = editorView.dom.parentElement?.contains(event.target)
              ? editorView.dom.parentElement
              : null;
          };

          window.addEventListener("dragstart", onDragStart);

          return {
            destroy() {
              window.removeEventListener("dragstart", onDragStart);
            },
          };
        },

        props: {
          handleDOMEvents: {
            drop(view, event) {
              if (
                dragContainer !== view.dom.parentElement ||
                event.dataTransfer?.effectAllowed === "copy"
              ) {
                dragContainer = null;
                wasDropOrPaste = true;
              }
              return false;
            },

            paste() {
              wasDropOrPaste = true;
              return false;
            },
          },

          transformPasted(slice) {
            if (!wasDropOrPaste) return slice;

            const { types, attributeName } = options;

            const transformFragment = (fragment) => {
              const children = [];

              fragment.forEach((child) => {
                if (child.isText) {
                  children.push(child);
                } else if (!types.includes(child.type.name)) {
                  children.push(child.copy(transformFragment(child.content)));
                } else {
                  children.push(
                    child.type.create(
                      {
                        ...child.attrs,
                        [attributeName]: null,
                      },
                      transformFragment(child.content),
                      child.marks,
                    ),
                  );
                }
              });

              return Fragment.from(children);
            };

            wasDropOrPaste = false;

            return new Slice(
              transformFragment(slice.content),
              slice.openStart,
              slice.openEnd,
            );
          },
        },
      }),
    ];
  },
});
