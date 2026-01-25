import "@/features/editor/styles/index.css";
import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Title } from "@mantine/core";
import classes from "./history.module.css";

export interface HistoryEditorProps {
  title: string;
  content: any;
}

export function HistoryEditor({ title, content }: HistoryEditorProps) {
  const editor = useEditor({
    extensions: mainExtensions,
    editable: false,
  });

  useEffect(() => {
    if (editor && content) {
      editor.commands.setContent(content);
    }
  }, [title, content, editor]);

  return (
    <>
      <div>
        <Title order={1}>{title}</Title>

        {editor && (
          <EditorContent editor={editor} className={classes.historyEditor} />
        )}
      </div>
    </>
  );
}
