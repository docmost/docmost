import "@/features/editor/styles/index.css";
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Title } from "@mantine/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import historyClasses from "./css/history.module.css";
import { normalizeHistoryTitle } from "@/features/page-history/utils/normalize-history-title";
import { splitChangeRange } from "@/features/page-history/utils/split-change-range";
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
  previousTitle?: string | null;
}

export function HistoryEditor({
  title,
  content,
  previousContent,
  previousTitle,
}: HistoryEditorProps) {
  const [highlightChanges] = useAtom(highlightChangesAtom);
  const [, setDiffCounts] = useAtom(diffCountsAtom);

  // The title is change 1 when it differs from the previous version
  const titleChanged =
    !!previousContent &&
    previousTitle !== undefined &&
    normalizeHistoryTitle(previousTitle) !== normalizeHistoryTitle(title);

  const editor = useEditor({
    extensions: mainExtensions,
    editable: false,
    textDirection: "auto",
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed || !content) return;

    let decorationSet = DecorationSet.empty;
    let addedCount = titleChanged ? 1 : 0;
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
        let changeIndex = titleChanged ? 1 : 0;

        for (const change of changes) {
          if (change.toB > change.fromB) {
            changeIndex++;
            const currentIndex = changeIndex;
            const segments = splitChangeRange(
              newContent,
              change.fromB,
              change.toB,
              specialNodeTypes,
            );

            for (const segment of segments) {
              decorations.push(
                segment.node
                  ? Decoration.node(segment.from, segment.to, {
                      class: "history-diff-node-added",
                      "data-diff-index": String(currentIndex),
                    })
                  : Decoration.inline(segment.from, segment.to, {
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
            const segments = splitChangeRange(
              oldContent,
              change.fromA,
              change.toA,
              specialNodeTypes,
            );

            // side keeps the deleted pieces in document order at the same position
            segments.forEach((segment, side) => {
              const deletedNode = segment.node;
              if (deletedNode) {
                decorations.push(
                  Decoration.widget(
                    change.fromB,
                    () => {
                      const wrapper = document.createElement("div");
                      wrapper.className = "history-diff-node-deleted";
                      wrapper.setAttribute(
                        "data-diff-index",
                        String(currentIndex),
                      );
                      const serializer = DOMSerializer.fromSchema(schema);
                      const dom = serializer.serializeNode(deletedNode);
                      wrapper.appendChild(dom);
                      return wrapper;
                    },
                    { side },
                  ),
                );
                return;
              }

              const deletedText = oldContent.textBetween(
                segment.from,
                segment.to,
                "",
              );
              if (deletedText) {
                decorations.push(
                  Decoration.widget(
                    change.fromB,
                    () => {
                      const span = document.createElement("span");
                      span.className = "history-diff-deleted";
                      span.setAttribute(
                        "data-diff-index",
                        String(currentIndex),
                      );
                      span.textContent = deletedText;
                      return span;
                    },
                    { side },
                  ),
                );
              }
            });
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
    titleChanged,
    highlightChanges,
    setDiffCounts,
  ]);

  return (
    <div className={historyClasses.historyEditor}>
      <Title order={1}>
        {titleChanged && highlightChanges ? (
          <>
            {previousTitle && (
              <span className="history-diff-deleted" data-diff-index="1">
                {previousTitle}
              </span>
            )}
            {previousTitle && " "}
            <span className="history-diff-added" data-diff-index="1">
              {title}
            </span>
          </>
        ) : (
          title
        )}
      </Title>
      {editor && (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}
