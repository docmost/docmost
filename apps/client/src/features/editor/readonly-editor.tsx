import classes from "@/features/editor/styles/editor.module.css";
import { Container } from "@mantine/core";
import { EditorProvider, useEditor, EditorContent } from "@tiptap/react";
import { readonlyEditorExtensions } from "@/features/editor/extensions/readonly-editor-extensions";
import { useTranslation } from "react-i18next";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import "@/features/editor/styles/index.css";

export interface ReadonlyEditorProps {
  title: string;
  content: string;
}

export function ReadonlyEditor({ title, content }: ReadonlyEditorProps) {
  const { t } = useTranslation();
  
  const titleEditor = useEditor({
    extensions: [
      Document.extend({ content: "heading" }),
      Heading.configure({ levels: [1] }),
      Text,
      Placeholder.configure({
        placeholder: t("Untitled"),
        showOnlyWhenEditable: false,
      }),
    ],
    editable: false,
    content: title,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
  });

  return (
    <Container
      fluid={false}
      size={900}
      className={classes.editor}
    >
      <EditorContent editor={titleEditor} />
      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={readonlyEditorExtensions}
        content={content}
      ></EditorProvider>
    </Container>
  );
}
