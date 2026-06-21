import type { Editor, Range } from "@tiptap/core";
import { v7 as uuid7 } from "uuid";
import { notifications } from "@mantine/notifications";
import api from "@/lib/api-client";

function findBaseEmbedPlaceholderPos(
  editor: Editor,
  pendingKey: string,
): number | null {
  let foundPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "base" && node.attrs.pendingKey === pendingKey) {
      foundPos = pos;
      return false;
    }
    return true;
  });
  return foundPos;
}

export async function insertBaseEmbedBlock(
  editor: Editor,
  opts: { template?: "kanban"; range?: Range } = {},
): Promise<void> {
  // @ts-ignore
  const parentPageId = editor.storage?.pageId as string | undefined;
  if (!parentPageId) return;

  const pendingKey = uuid7();

  const chain = editor.chain().focus();
  if (opts.range) chain.deleteRange(opts.range);
  chain.insertBaseEmbed({ pageId: null, pendingKey }).run();

  try {
    const res = await api.post<{ id: string }>("/bases/create", {
      parentPageId,
      ...(opts.template ? { template: opts.template } : {}),
    });

    const pos = findBaseEmbedPlaceholderPos(editor, pendingKey);
    if (pos === null) return;
    editor
      .chain()
      .command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, {
          pageId: res.data.id,
          pendingKey: null,
        });
        return true;
      })
      .run();
  } catch {
    const pos = findBaseEmbedPlaceholderPos(editor, pendingKey);
    if (pos !== null) {
      editor
        .chain()
        .command(({ tr }) => {
          const node = tr.doc.nodeAt(pos);
          if (node) tr.delete(pos, pos + node.nodeSize);
          return true;
        })
        .run();
    }
    notifications.show({ message: "Failed to create base", color: "red" });
  }
}
