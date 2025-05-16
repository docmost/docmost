import { EditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { StarterKit } from "@tiptap/starter-kit";
import classes from "./comment.module.css";
import { useFocusWithin } from "@mantine/hooks";
import clsx from "clsx";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import EmojiCommand from "@/features/editor/extensions/emoji-command";

interface CommentEditorProps {
  defaultContent?: any;
  onUpdate?: any;
  onSave?: any;
  editable: boolean;
  placeholder?: string;
  autofocus?: boolean;
}

const CommentEditor = forwardRef(
  (
    {
      defaultContent,
      onUpdate,
      onSave,
      editable,
      placeholder,
      autofocus,
    }: CommentEditorProps,
    ref,
  ) => {
    const { t } = useTranslation();
    const { ref: focusRef, focused } = useFocusWithin();

    const commentEditor = useEditor({
      extensions: [
        StarterKit.configure({
          gapcursor: false,
          dropcursor: false,
        }),
        Placeholder.configure({
          placeholder: placeholder || t("Reply..."),
        }),
        Underline,
        Link,
        EmojiCommand,
      ],
      editorProps: {
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              if (emojiCommand) {
                return true;
              }
            }

            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              if (onSave) onSave();

              return true;
            }
          },
        },
      },
      onUpdate({ editor }) {
        if (onUpdate) onUpdate(editor.getJSON());
      },
      content: defaultContent,
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: (autofocus && "end") || false,
    });

    useEffect(() => {
      commentEditor.commands.setContent(defaultContent);
    }, [defaultContent]);

    useEffect(() => {
      setTimeout(() => {
        if (autofocus) {
          commentEditor?.commands.focus("end");
        }
      }, 10);
    }, [commentEditor, autofocus]);

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        commentEditor.commands.clearContent();
      },
    }));

    return (
      <div ref={focusRef} className={classes.commentEditor}>
        <EditorContent
          editor={commentEditor}
          className={clsx(classes.ProseMirror, { [classes.focused]: focused })}
        />
      </div>
    );
  },
);

export default CommentEditor;
