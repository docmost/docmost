import "@/features/editor/styles/index.css";
import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Badge, Divider, Group, Text, Title } from "@mantine/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import classes from "./history-diff.module.css";
import historyClasses from "./history.module.css";
import { recreateTransform } from "@docmost/editor-ext";
import { DOMSerializer, Node } from "@tiptap/pm/model";
import { ChangeSet, simplifyChanges } from "prosemirror-changeset";

export interface HistoryEditorProps {
  title: string;
  content: any;
  previousContent?: any;
  highlightChanges?: boolean;
}

export function HistoryEditor({
  title,
  content,
  previousContent,
  highlightChanges = true,
}: HistoryEditorProps) {
  const editor = useEditor({
    extensions: mainExtensions,
    editable: false,
  });

  const [diffCounts, setDiffCounts] = useState<{
    added: number;
    deleted: number;
  }>({
    added: 0,
    deleted: 0,
  });

  useEffect(() => {
    if (!editor || !content) return;

    let decorationSet = DecorationSet.empty;
    let addedCount = 0;
    let deletedCount = 0;

    if (previousContent) {
      try {
        const schema = editor.schema;
        const docOld = Node.fromJSON(schema, previousContent);
        const docNew = Node.fromJSON(schema, content);

        const tr = recreateTransform(docOld, docNew, {
          complexSteps: true,
          wordDiffs: true,
          simplifyDiff: true,
        });

        const changeSet = ChangeSet.create(docOld).addSteps(
          tr.doc,
          tr.mapping.maps,
          [],
        );
        const changes = simplifyChanges(changeSet.changes, docNew);

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
        for (const change of changes) {
          if (change.toB > change.fromB) {
            let foundSpecialNode: { node: Node; pos: number } | null = null;
            docNew.nodesBetween(change.fromB, change.toB, (node, pos) => {
              if (specialNodeTypes.has(node.type.name)) {
                const nodeEnd = pos + node.nodeSize;
                // Only match if change spans the entire node (not just content inside)
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
                }),
              );
            } else {
              decorations.push(
                Decoration.inline(change.fromB, change.toB, {
                  class: "history-diff-added",
                }),
              );
            }
            addedCount += 1;
          }
          if (change.toA > change.fromA) {
            let foundDeletedNode: { node: Node; pos: number } | null = null;
            docOld.nodesBetween(change.fromA, change.toA, (node, pos) => {
              if (specialNodeTypes.has(node.type.name)) {
                const nodeEnd = pos + node.nodeSize;
                // Only match if change spans the entire node (not just content inside)
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
                  const serializer = DOMSerializer.fromSchema(schema);
                  const dom = serializer.serializeNode(foundDeletedNode!.node);
                  wrapper.appendChild(dom);
                  return wrapper;
                }),
              );
            } else {
              const deletedText = docOld.textBetween(
                change.fromA,
                change.toA,
                "",
              );
              if (deletedText) {
                decorations.push(
                  Decoration.widget(change.fromB, () => {
                    const span = document.createElement("span");
                    span.className = "history-diff-deleted";
                    span.textContent = deletedText;
                    return span;
                  }),
                );
              }
            }
            deletedCount += 1;
          }
        }

        decorationSet = DecorationSet.create(docNew, decorations);
      } catch (e) {
        console.error("History diff failed:", e);
        editor.commands.setContent(content);
      }
    } else {
      editor.commands.setContent(content);
    }

    setDiffCounts({ added: addedCount, deleted: deletedCount });

    editor.setOptions({
      editorProps: {
        ...editor.options.editorProps,
        decorations: () =>
          highlightChanges ? decorationSet : DecorationSet.empty,
      },
    });
  }, [title, content, editor, previousContent, highlightChanges]);

  return (
    <>
      <div>
        <Title order={1}>{title}</Title>

        {previousContent && (
          <>
            <Divider my="md" />
            <div className={classes.diffSummary}>
              <Group gap="xs" wrap="wrap">
                <Text fw={600}>Changes</Text>
                <Badge variant="light" color="green">
                  +{diffCounts.added} added
                </Badge>
                <Badge variant="light" color="red">
                  -{diffCounts.deleted} deleted
                </Badge>
                <Text size="sm" c="dimmed">
                  (added = green, deleted = red/strikethrough)
                </Text>
              </Group>
            </div>
            <Divider my="md" />
          </>
        )}

        {editor && (
          <EditorContent
            editor={editor}
            className={historyClasses.historyEditor}
          />
        )}
      </div>
    </>
  );
}
