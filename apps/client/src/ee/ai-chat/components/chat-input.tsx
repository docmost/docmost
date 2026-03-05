import { useCallback, useRef, useEffect, useState } from "react";
import { IconArrowUp, IconPaperclip, IconPlayerStopFilled, IconX, IconFile, IconPhoto } from "@tabler/icons-react";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { StarterKit } from "@tiptap/starter-kit";
import { Mention, LinkExtension } from "@docmost/editor-ext";
import EmojiCommand from "@/features/editor/extensions/emoji-command";
import mentionRenderItems from "@/features/editor/components/mention/mention-suggestion";
import MentionView from "@/features/editor/components/mention/mention-view";
import { uploadChatFile } from "../services/ai-chat-service";
import type { ChatAttachment, PageMention } from "../types/ai-chat.types";
import classes from "../styles/chat-input.module.css";

type PendingAttachment = ChatAttachment & { uploading: boolean };

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"];
const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.csv,.md,.png,.jpg,.jpeg,.webp";

type Props = {
  isStreaming: boolean;
  onSend: (content: string, mentions: PageMention[], attachments: ChatAttachment[]) => void;
  onStop: () => void;
  placeholder?: string;
  autofocus?: boolean;
};

function extractMentions(json: any): PageMention[] {
  const mentions: PageMention[] = [];
  const seen = new Set<string>();

  function walk(node: any) {
    if (node.type === "mention" && node.attrs?.entityType === "page" && node.attrs?.entityId) {
      if (!seen.has(node.attrs.entityId)) {
        seen.add(node.attrs.entityId);
        mentions.push({
          id: node.attrs.entityId,
          title: node.attrs.label || "",
          slugId: node.attrs.slugId || "",
        });
      }
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(json);
  return mentions;
}

function editorJsonToText(json: any): string {
  let text = "";

  function walk(node: any) {
    if (node.type === "text") {
      text += node.text || "";
    } else if (node.type === "mention") {
      text += `@${node.attrs?.label || ""}`;
    } else if (node.type === "paragraph") {
      if (text.length > 0) text += "\n";
      if (node.content) {
        for (const child of node.content) {
          walk(child);
        }
      }
      return;
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(json);
  return text;
}

export default function ChatInput({
  isStreaming,
  onSend,
  onStop,
  placeholder,
  autofocus = true,
}: Props) {
  const [isEmpty, setIsEmpty] = useState(true);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onSendRef = useRef(onSend);
  onSendRef.current = onSend;

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      const tempId = `uploading-${Date.now()}-${Math.random()}`;
      const ext = file.name.split(".").pop()?.toLowerCase() || "";

      const placeholder: PendingAttachment = {
        id: tempId,
        fileName: file.name,
        fileExt: ext,
        fileSize: file.size,
        mimeType: file.type,
        uploading: true,
      };

      setPendingAttachments((prev) => [...prev, placeholder]);

      try {
        const uploaded = await uploadChatFile(file);
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === tempId ? { ...uploaded, uploading: false } : a,
          ),
        );
      } catch {
        setPendingAttachments((prev) => prev.filter((a) => a.id !== tempId));
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!editor || isStreaming) return;
    const json = editor.getJSON();
    const text = editorJsonToText(json).trim();
    const readyAttachments = pendingAttachments.filter((a) => !a.uploading);
    if (!text && readyAttachments.length === 0) return;

    const mentions = extractMentions(json);
    onSendRef.current(text, mentions, readyAttachments);
    editor.commands.clearContent();
    editor.commands.focus();
    setPendingAttachments([]);
  }, [isStreaming, pendingAttachments]);

  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        gapcursor: false,
        dropcursor: false,
        link: false,
      }),
      Placeholder.configure({
        placeholder: placeholder || "Ask anything... Use @ to mention pages",
      }),
      LinkExtension,
      EmojiCommand,
      Mention.configure({
        suggestion: {
          allowSpaces: true,
          items: () => [],
          // @ts-ignore
          render: mentionRenderItems,
        },
        HTMLAttributes: {
          class: "mention",
        },
      }).extend({
        addNodeView() {
          this.editor.isInitialized = true;
          return ReactNodeViewRenderer(MentionView);
        },
      }),
    ],
    editorProps: {
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"].includes(
              event.key,
            )
          ) {
            const emojiCommand = document.querySelector("#emoji-command");
            const mentionPopup = document.querySelector("#mention");
            if (emojiCommand || mentionPopup) {
              return true;
            }
          }

          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmitRef.current();
            return true;
          }
        },
      },
    },
    content: "",
    editable: true,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    autofocus: autofocus ? "end" : false,
    onUpdate: ({ editor: e }) => {
      setIsEmpty(!e.getText().trim());
    },
  });

  useEffect(() => {
    if (editor && autofocus) {
      editor.commands.focus();
    }
  }, [editor]);

  const hasContent = !isEmpty || pendingAttachments.some((a) => !a.uploading);

  return (
    <div className={classes.inputWrapper} data-chat-input>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_FILE_TYPES}
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {pendingAttachments.length > 0 && (
        <div className={classes.attachmentChips}>
          {pendingAttachments.map((attachment) => (
            <div
              key={attachment.id}
              className={`${classes.attachmentChip} ${attachment.uploading ? classes.attachmentChipUploading : ""}`}
            >
              {IMAGE_EXTENSIONS.includes(attachment.fileExt) ? (
                <IconPhoto size={14} />
              ) : (
                <IconFile size={14} />
              )}
              <span className={classes.attachmentChipName}>
                {attachment.fileName}
              </span>
              {!attachment.uploading && (
                <button
                  type="button"
                  className={classes.attachmentChipRemove}
                  onClick={() => removeAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.fileName}`}
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <EditorContent editor={editor} className={classes.editorContent} />
      <div className={classes.actions}>
        <button
          type="button"
          className={classes.attachButton}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
        >
          <IconPaperclip size={18} />
        </button>

        <div style={{ flex: 1 }} />

        {isStreaming ? (
          <button
            type="button"
            className={classes.stopButton}
            onClick={onStop}
            aria-label="Stop generation"
          >
            <IconPlayerStopFilled size={14} />
          </button>
        ) : (
          <button
            type="button"
            className={classes.sendButton}
            onClick={handleSubmit}
            disabled={!hasContent}
            aria-label="Send message"
          >
            <IconArrowUp size={16} stroke={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
