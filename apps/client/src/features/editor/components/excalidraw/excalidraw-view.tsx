import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { DiagramPlaceholder } from "../common/diagram-placeholder";
import { useDiagramEditor } from "../common/use-diagram-editor";
import { ExcalidrawEditor } from "./excalidraw-editor";

export default function ExcalidrawView({
  editor,
  node,
  selected,
  getPos,
}: NodeViewProps) {
  const editing = useDiagramEditor(editor, "excalidraw");
  return (
    <NodeViewWrapper data-drag-handle>
      <DiagramPlaceholder
        editor={editor}
        node={node}
        selected={selected}
        type="excalidraw"
        onOpen={(name) => void editing.open(node, getPos, name)}
      />
      {editing.session && (
        <ExcalidrawEditor session={editing.session} onClose={editing.close} />
      )}
    </NodeViewWrapper>
  );
}
