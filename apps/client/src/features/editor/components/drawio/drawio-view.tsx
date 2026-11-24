import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { DiagramPlaceholder } from "../common/diagram-placeholder";
import { useDiagramEditor } from "../common/use-diagram-editor";
import { DrawioEditor } from "./drawio-editor";

export default function DrawioView({
  editor,
  node,
  selected,
  getPos,
}: NodeViewProps) {
  const editing = useDiagramEditor(editor, "drawio");
  return (
    <NodeViewWrapper data-drag-handle>
      <DiagramPlaceholder
        editor={editor}
        node={node}
        selected={selected}
        type="drawio"
        onOpen={(name) => void editing.open(node, getPos, name)}
      />
      {editing.session && (
        <DrawioEditor session={editing.session} onClose={editing.close} />
      )}
    </NodeViewWrapper>
  );
}
