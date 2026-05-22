import { EditorProvider } from "@tiptap/react";
import { useMemo } from "react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { UniqueID } from "@docmost/editor-ext";

type Props = {
  content: unknown;
};

export default function TransclusionContent({ content }: Props) {
  const extensions = useMemo(() => {
    const filtered = mainExtensions.filter(
      (e: any) => e.name !== "uniqueID" && e.name !== "globalDragHandle",
    );
    return [
      ...filtered,
      UniqueID.configure({
        types: ["heading", "paragraph", "transclusionSource"],
        updateDocument: false,
      }),
    ];
  }, []);

  // Isolate the nested read-only editor's events from the host editor:
  // - mousedown/click would otherwise make the host node-select the atom
  //   wrapper, blocking native text selection inside.
  // - dragstart/dragover/drop would otherwise let the host treat events
  //   inside the nested view as drops on the host, duplicating dropped
  //   files at the transclusion's position.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      onMouseDown={stop}
      onClick={stop}
      onDragStart={stop}
      onDragOver={stop}
      onDrop={stop}
    >
      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={extensions}
        content={content as any}
      />
    </div>
  );
}
