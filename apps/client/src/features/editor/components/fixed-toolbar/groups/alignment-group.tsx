import { FC, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { TextAlignmentSelector } from "@/features/editor/components/bubble-menu/text-alignment-selector";

interface Props {
  editor: Editor;
}

export const AlignmentGroup: FC<Props> = ({ editor }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <TextAlignmentSelector
      editor={editor}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    />
  );
};
