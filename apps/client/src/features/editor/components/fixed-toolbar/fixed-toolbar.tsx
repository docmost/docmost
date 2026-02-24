import { FC, useState } from "react";
import { useEditorState } from "@tiptap/react";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { NodeSelector } from "../bubble-menu/node-selector";
import { TextAlignmentSelector } from "../bubble-menu/text-alignment-selector";

export const FixedToolbar: FC = () => {
  const editor = useAtomValue(pageEditorAtom);
  const [isNodeSelectorOpen, setIsNodeSelectorOpen] = useState(false);
  const [isTextAlignmentOpen, setIsTextAlignmentOpen] = useState(false);

  const editorIsEditable = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.isEditable ?? false,
  });

  if (!editor || !editorIsEditable) {
    return null;
  }

  return (
    <>
      <NodeSelector
        editor={editor}
        isOpen={isNodeSelectorOpen}
        setIsOpen={() => {
          setIsNodeSelectorOpen(!isNodeSelectorOpen);
          setIsTextAlignmentOpen(false);
        }}
      />

      <TextAlignmentSelector
        editor={editor}
        isOpen={isTextAlignmentOpen}
        setIsOpen={() => {
          setIsTextAlignmentOpen(!isTextAlignmentOpen);
          setIsNodeSelectorOpen(false);
        }}
      />
    </>
  );
};
