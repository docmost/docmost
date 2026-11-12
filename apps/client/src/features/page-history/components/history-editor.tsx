import "@/features/editor/styles/index.css";
import { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Title } from "@mantine/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import historyClasses from "./css/history.module.css";
import { normalizeHistoryTitle } from "@/features/page-history/utils/normalize-history-title";
import { splitChangeRange } from "@/features/page-history/utils/split-change-range";
import { createHistoryTokenEncoder } from "@/features/page-history/utils/history-token-encoder";
import { inlineFragment } from "@/features/page-history/utils/inline-fragment";
import {
  formatChange,
  markChangeLabel,
  nodeChangeLabel,
} from "@/features/page-history/utils/format-change";
import { recreateTransform } from "@docmost/editor-ext";
import { DOMSerializer, Node } from "@tiptap/pm/model";
import { ChangeSet, simplifyChanges } from "@tiptap/pm/changeset";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    let formattedCount = 0;

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

        const changeSet = ChangeSet.create(
          oldContent,
          undefined,
          createHistoryTokenEncoder(),
        ).addSteps(tr.doc, tr.mapping.maps, []);
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
          // text that only changed formatting shows once, on the new side
          const format = formatChange(oldContent, newContent, change);
          if (format) {
            if (format.ranges.length || format.nodes.length) {
              changeIndex++;
              const currentIndex = changeIndex;
              const label = markChangeLabel(format, t);

              for (const range of format.ranges) {
                decorations.push(
                  Decoration.inline(range.from, range.to, {
                    class: "history-diff-formatted",
                    title: label,
                    "data-diff-index": String(currentIndex),
                  }),
                );
              }
              for (const { pos, node, oldNode } of format.nodes) {
                const nodeLabel = nodeChangeLabel(oldNode, node, t);
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: "history-diff-node-formatted",
                    "data-diff-label": nodeLabel,
                    "data-diff-index": String(currentIndex),
                  }),
                );
              }
              formattedCount += 1;
            }
            continue;
          }

          const added = splitChangeRange(
            newContent,
            change.fromB,
            change.toB,
            specialNodeTypes,
          );
          if (added.length) {
            changeIndex++;
            const currentIndex = changeIndex;

            for (const segment of added) {
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
          const deleted = splitChangeRange(
            oldContent,
            change.fromA,
            change.toA,
            specialNodeTypes,
          );
          if (deleted.length) {
            changeIndex++;
            const currentIndex = changeIndex;

            // side keeps the deleted pieces in document order at the same position
            deleted.forEach((segment, side) => {
              // empty marks keep it out of the formatting of the text after it
              const spec = { side, marks: [] };
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
                    spec,
                  ),
                );
                return;
              }

              // keep the old marks so removed formatting still shows
              const fragment = inlineFragment(
                oldContent,
                segment.from,
                segment.to,
              );
              const deletedText = oldContent.textBetween(
                segment.from,
                segment.to,
                "",
              );
              if (fragment || deletedText) {
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
                      if (fragment) {
                        span.appendChild(
                          DOMSerializer.fromSchema(schema).serializeFragment(
                            fragment,
                          ),
                        );
                      } else {
                        span.textContent = deletedText;
                      }
                      return span;
                    },
                    spec,
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

    const total = addedCount + deletedCount + formattedCount;
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
    t,
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
