import { Extension } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    moveBlock: {
      moveBlockUp: () => ReturnType;
      moveBlockDown: () => ReturnType;
    };
  }
}

export const MoveBlock = Extension.create({
  name: "moveBlock",

  addCommands() {
    return {
      moveBlockUp:
        () =>
        ({ state, dispatch }) => {
          const { doc, selection, tr } = state;
          const $from = selection.$from;

          // Find the top-level block containing the selection
          if ($from.depth < 1) return false;

          const blockIndex = $from.index(0);
          if (blockIndex === 0) return false; // Already at top

          const currentBlock = doc.child(blockIndex);
          const prevBlock = doc.child(blockIndex - 1);

          // Calculate positions
          let pos = 0;
          for (let i = 0; i < blockIndex - 1; i++) {
            pos += doc.child(i).nodeSize;
          }
          const prevBlockStart = pos;
          const prevBlockEnd = prevBlockStart + prevBlock.nodeSize;
          const currentBlockStart = prevBlockEnd;
          const currentBlockEnd = currentBlockStart + currentBlock.nodeSize;

          if (dispatch) {
            // Calculate the offset of the selection within the current block
            const selFromOffset = selection.from - currentBlockStart;
            const selToOffset = selection.to - currentBlockStart;

            // Replace the range [prevBlockStart, currentBlockEnd] with [currentBlock, prevBlock]
            const newContent = Fragment.from([currentBlock, prevBlock]);
            tr.replaceWith(prevBlockStart, currentBlockEnd, newContent);

            // Restore selection at new position (current block is now at prevBlockStart)
            const newFrom = prevBlockStart + selFromOffset;
            const newTo = prevBlockStart + selToOffset;
            tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));

            dispatch(tr);
          }

          return true;
        },

      moveBlockDown:
        () =>
        ({ state, dispatch }) => {
          const { doc, selection, tr } = state;
          const $from = selection.$from;

          if ($from.depth < 1) return false;

          const blockIndex = $from.index(0);
          if (blockIndex >= doc.childCount - 1) return false; // Already at bottom

          const currentBlock = doc.child(blockIndex);
          const nextBlock = doc.child(blockIndex + 1);

          // Calculate positions
          let pos = 0;
          for (let i = 0; i < blockIndex; i++) {
            pos += doc.child(i).nodeSize;
          }
          const currentBlockStart = pos;
          const currentBlockEnd = currentBlockStart + currentBlock.nodeSize;
          const nextBlockEnd = currentBlockEnd + nextBlock.nodeSize;

          if (dispatch) {
            const selFromOffset = selection.from - currentBlockStart;
            const selToOffset = selection.to - currentBlockStart;

            // Replace [currentBlockStart, nextBlockEnd] with [nextBlock, currentBlock]
            const newContent = Fragment.from([nextBlock, currentBlock]);
            tr.replaceWith(currentBlockStart, nextBlockEnd, newContent);

            // Current block is now after nextBlock
            const newBlockStart = currentBlockStart + nextBlock.nodeSize;
            const newFrom = newBlockStart + selFromOffset;
            const newTo = newBlockStart + selToOffset;
            tr.setSelection(TextSelection.create(tr.doc, newFrom, newTo));

            dispatch(tr);
          }

          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => this.editor.commands.moveBlockUp(),
      "Alt-ArrowDown": () => this.editor.commands.moveBlockDown(),
    };
  },
});
