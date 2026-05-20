import { FC, useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { ColorSelector } from "@/features/editor/components/bubble-menu/color-selector";

interface Props {
  editor: Editor;
}

export const ColorGroup: FC<Props> = ({ editor }) => {
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
    <ColorSelector editor={editor} isOpen={isOpen} setIsOpen={setIsOpen} />
  );
};
