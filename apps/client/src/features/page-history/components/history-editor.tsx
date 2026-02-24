import "@/features/editor/styles/index.css";
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Title } from "@mantine/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import historyClasses from "./css/history.module.css";
import { recreateTransform } from "@docmost/editor-ext";
import { DOMSerializer, Node } from "@tiptap/pm/model";
import { ChangeSet, simplifyChanges } from "@tiptap/pm/changeset";
import { useAtom } from "jotai";
import {
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";

export interface HistoryEditorProps {
  title: string;
  content: any;
  previousContent?: any;
}

export function HistoryEditor({
  title,
  content,
  previousContent,
}: HistoryEditorProps) {
  const [highlightChanges] = useAtom(highlightChangesAtom);
  const [, setDiffCounts] = useAtom(diffCountsAtom);

  const editor = useEditor({
    extensions: mainExtensions,
    editable: false,
  });

  useEffect(() => {
    if (!editor || !content) return;

    let decorationSet = DecorationSet.empty;
    let addedCount = 0;
    let deletedCount = 0;

    if (previousContent) {
      try {
        const schema = editor.schema;
        const oldContent = Node.fromJSON(schema, previousContent);
        const newContent = Node.fromJSON(schema, content);

        const tr = recreateTransform(oldContent, newContent, {
          complexSteps: false,
          wordDiffs: true,
          simplifyDiff: true,
        });

        const changeSet = ChangeSet.create(oldContent).addSteps(
          tr.doc,
          tr.mapping.maps,
          [],
        );
        const changes = simplifyChanges(changeSet.changes, newContent);

        editor.commands.setContent(content);

        const specialNodeTypes = new Set([
          "image",
          "attachment",
          "video",
          "excalidraw",
          "drawio",
          "mermaid",
          "mathBlock",
          "mathInline",
          "table",
          "details",
          "callout",
        ]);

        const decorations: Decoration[] = [];
        let changeIndex = 0;

        for (const change of changes) {
          if (change.toB > change.fromB) {
            changeIndex++;
            const currentIndex = changeIndex;
            let foundSpecialNode: { node: Node; pos: number } | null = null;
            newContent.nodesBetween(change.fromB, change.toB, (node, pos) => {
              if (specialNodeTypes.has(node.type.name)) {
                const nodeEnd = pos + node.nodeSize;
                if (change.fromB <= pos && change.toB >= nodeEnd) {
                  foundSpecialNode = { node, pos };
                  return false;
                }
              }
            });

            if (foundSpecialNode) {
              const nodeEnd =
                foundSpecialNode.pos + foundSpecialNode.node.nodeSize;
              decorations.push(
                Decoration.node(foundSpecialNode.pos, nodeEnd, {
                  class: "history-diff-node-added",
                  "data-diff-index": String(currentIndex),
                }),
              );
            } else {
              decorations.push(
                Decoration.inline(change.fromB, change.toB, {
                  class: "history-diff-added",
                  "data-diff-index": String(currentIndex),
                }),
              );
            }
            addedCount += 1;
          }
          if (change.toA > change.fromA) {
            changeIndex++;
            const currentIndex = changeIndex;
            let foundDeletedNode: { node: Node; pos: number } | null = null;
            oldContent.nodesBetween(change.fromA, change.toA, (node, pos) => {
              if (specialNodeTypes.has(node.type.name)) {
                const nodeEnd = pos + node.nodeSize;
                if (change.fromA <= pos && change.toA >= nodeEnd) {
                  foundDeletedNode = { node, pos };
                  return false;
                }
              }
            });

            if (foundDeletedNode) {
              decorations.push(
                Decoration.widget(change.fromB, () => {
                  const wrapper = document.createElement("div");
                  wrapper.className = "history-diff-node-deleted";
                  wrapper.setAttribute("data-diff-index", String(currentIndex));
                  const serializer = DOMSerializer.fromSchema(schema);
                  const dom = serializer.serializeNode(foundDeletedNode!.node);
                  wrapper.appendChild(dom);
                  return wrapper;
                }),
              );
            } else {
              const deletedText = oldContent.textBetween(
                change.fromA,
                change.toA,
                "",
              );
              if (deletedText) {
                decorations.push(
                  Decoration.widget(change.fromB, () => {
                    const span = document.createElement("span");
                    span.className = "history-diff-deleted";
                    span.setAttribute("data-diff-index", String(currentIndex));
                    span.textContent = deletedText;
                    return span;
                  }),
                );
              }
            }
            deletedCount += 1;
          }
        }

        decorationSet = DecorationSet.create(newContent, decorations);
      } catch (e) {
        console.error("History diff failed:", e);
        editor.commands.setContent(content);
      }
    } else {
      editor.commands.setContent(content);
    }

    const total = addedCount + deletedCount;
    // @ts-ignore
    setDiffCounts({ added: addedCount, deleted: deletedCount, total });

    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        decorations: () =>
          highlightChanges ? decorationSet : DecorationSet.empty,
      },
    });
  }, [
    title,
    content,
    editor,
    previousContent,
    highlightChanges,
    setDiffCounts,
  ]);

  return (
    <div>
      <Title order={1}>{title}</Title>
      {editor && (
        <EditorContent
          editor={editor}
          className={historyClasses.historyEditor}
        />
      )}
    </div>
  );
}
