import "@/features/editor/styles/index.css";
import React, { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Badge, Divider, Group, Text, Title } from "@mantine/core";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { computeHistoryBlockDiff } from "@/features/page-history/utils/history-diff";
import classes from "./history-diff.module.css";
import historyClasses from "./history.module.css";
import { recreateTransform } from "@docmost/editor-ext";
import { Node, Schema, DOMSerializer } from "@tiptap/pm/model";

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
    if (editor && previousContent && content) {
      const schema = editor.schema;

      try {
        console.log(
          "previousContent type:",
          previousContent?.type,
          "content type:",
          content?.type,
        );
        const docOld = Node.fromJSON(schema, previousContent);
        const docNew = Node.fromJSON(schema, content);

        const t0 = performance.now();
        const transform = recreateTransform(docOld, docNew, {
          complexSteps: true,
          wordDiffs: true,
          simplifyDiff: true,
        });
        console.log(
          `recreateTransform: ${(performance.now() - t0).toFixed(3)}ms`,
        );

        //console.log(transform);
      } catch (e) {
        console.error("Node.fromJSON failed:", e);
      }
    }
  }, [editor]);

  useEffect(() => {
    if (editor && content) {
      let decorationSet = DecorationSet.empty;
      let addedCount = 0;
      let deletedCount = 0;

      if (previousContent) {
        try {
          const currentDoc = editor.schema.nodeFromJSON(content);
          const prevDoc = editor.schema.nodeFromJSON(previousContent);
          const {
            diffDoc,
            addedNodeRanges,
            deletedNodeRanges,
            addedCount: aCount,
            deletedCount: dCount,
          } = computeHistoryBlockDiff(currentDoc, prevDoc);

          editor.commands.setContent(diffDoc.toJSON());

          addedCount = aCount;
          deletedCount = dCount;

          const decos = addedNodeRanges.map((r) =>
            Decoration.node(r.from, r.to, { class: "history-diff-added" }),
          );
          const deletedDecos = deletedNodeRanges.map((r) =>
            Decoration.node(r.from, r.to, { class: "history-diff-deleted" }),
          );

          decorationSet = DecorationSet.create(diffDoc, [
            ...decos,
            ...deletedDecos,
          ]);
        } catch {
          decorationSet = DecorationSet.empty;
          addedCount = 0;
          deletedCount = 0;
          editor.commands.setContent(content);
        }
      } else {
        editor.commands.setContent(content);
      }

      setDiffCounts({ added: addedCount, deleted: deletedCount });

      const existingEditorProps = editor.options.editorProps ?? {};
      editor.setOptions({
        editorProps: {
          ...existingEditorProps,
          decorations: () => decorationSet,
        },
      });
    }
  }, [title, content, editor, previousContent]);

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
