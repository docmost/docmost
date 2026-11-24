import type { Editor } from "@tiptap/core";

export function diagramAttachmentName(attrs: { title?: string; src?: string }) {
  if (attrs.title?.toLowerCase().endsWith(".svg")) return attrs.title;
  // Older imports sometimes used a generic title for a named attachment.
  const segment = attrs.src?.split(/[?#]/)[0].split("/").pop();
  if (segment?.toLowerCase().endsWith(".svg")) {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }
}

export function diagramName(fileName: string) {
  return fileName
    .replace(/(?:\.(?:drawio|excalidraw))?\.svg$/i, "")
    .trim()
    .normalize("NFC");
}

export function pageDiagramNames(editor: Editor, exceptId?: string) {
  const names = new Set<string>();
  editor.state.doc.descendants((node) => {
    if (node.type.name !== "drawio" && node.type.name !== "excalidraw") return;
    if (exceptId && node.attrs.attachmentId === exceptId) return;
    const fileName = diagramAttachmentName(node.attrs) || node.attrs.title;
    if (fileName) names.add(diagramName(fileName).toLowerCase());
  });
  return names;
}

export function suggestDiagramName(editor: Editor, base: string) {
  const taken = pageDiagramNames(editor);
  let name = base;
  for (let index = 2; taken.has(name.toLowerCase()); index++) {
    name = `${base} ${index}`;
  }
  return name;
}
