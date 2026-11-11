import { type FormEvent, useId, useMemo, useState } from "react";
import {
  ActionIcon,
  Button,
  Group,
  Input,
  Popover,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { EditorProps } from "@tiptap/pm/view";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  IconBold,
  IconItalic,
  IconLink,
  IconMoodSmile,
  IconUnderline,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import EmojiPicker from "@/components/ui/emoji-picker.tsx";
import { platformModifierKey } from "@/lib";
import { ANNOUNCEMENT_MAX_TEXT_LENGTH } from "@/ee/announcement/announcement.constants";
import {
  getAnnouncementPlainText,
  isSafeAnnouncementHref,
} from "@/ee/announcement/announcement.utils";
import { createAnnouncementEditorExtensions } from "@/ee/announcement/components/announcement-editor-extensions";
import type { IAnnouncementContent } from "@/ee/announcement/types/announcement.types";
import toolbarClasses from "@/features/editor/components/fixed-toolbar/fixed-toolbar.module.css";
import classes from "./announcement-message-editor.module.css";

const COUNTER_THRESHOLD = 400;

type AnnouncementMessageEditorProps = {
  initialContent: IAnnouncementContent | null;
  onChange: (content: IAnnouncementContent) => void;
  error?: string;
};

export function AnnouncementMessageEditor({
  initialContent,
  onChange,
  error,
}: AnnouncementMessageEditorProps) {
  const { t } = useTranslation();
  const id = useId();
  const [textLength, setTextLength] = useState(() =>
    initialContent ? getAnnouncementPlainText(initialContent).length : 0,
  );
  const [linkOpened, setLinkOpened] = useState(false);

  const extensions = useMemo(
    () => createAnnouncementEditorExtensions(t("Write a message")),
    [t],
  );
  const editorProps = useMemo(
    (): EditorProps => ({
      attributes: {
        role: "textbox",
        "aria-multiline": "false",
        "aria-required": "true",
        "aria-labelledby": `${id}-label`,
        ...(error
          ? { "aria-invalid": "true", "aria-describedby": `${id}-error` }
          : {}),
      },
      handleKeyDown: (_view, event) => {
        if (!platformModifierKey(event) || event.key.toLowerCase() !== "k") {
          return false;
        }
        setLinkOpened(true);
        return true;
      },
    }),
    [id, error],
  );

  const editor = useEditor({
    extensions,
    content: initialContent ?? "",
    editorProps,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor: current }) => {
      setTextLength(current.state.doc.textContent.length);
      onChange(current.getJSON() as unknown as IAnnouncementContent);
    },
  });

  const marks = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      link: current?.isActive("link") ?? false,
    }),
  });

  const formatButtons = [
    {
      mark: "bold",
      label: t("Bold"),
      Icon: IconBold,
      toggle: (current: Editor) => current.chain().focus().toggleBold().run(),
    },
    {
      mark: "italic",
      label: t("Italic"),
      Icon: IconItalic,
      toggle: (current: Editor) => current.chain().focus().toggleItalic().run(),
    },
    {
      mark: "underline",
      label: t("Underline"),
      Icon: IconUnderline,
      toggle: (current: Editor) =>
        current.chain().focus().toggleUnderline().run(),
    },
  ] as const;

  return (
    <Input.Wrapper
      id={id}
      label={t("Message")}
      labelElement="div"
      error={error}
      withAsterisk
    >
      <div className={classes.root} data-error={error ? true : undefined}>
        <div
          className={classes.toolbar}
          role="toolbar"
          aria-label={t("Editor toolbar")}
        >
          {formatButtons.map(({ mark, label, Icon, toggle }) => (
            <Tooltip key={mark} label={label} withArrow>
              <ActionIcon
                variant="subtle"
                color="dark"
                size="md"
                aria-label={label}
                aria-pressed={marks[mark]}
                className={clsx({ [toolbarClasses.active]: marks[mark] })}
                onClick={() => editor && toggle(editor)}
              >
                <Icon size={16} aria-hidden />
              </ActionIcon>
            </Tooltip>
          ))}

          <Popover
            opened={linkOpened}
            onChange={setLinkOpened}
            position="bottom-start"
            width={360}
            shadow="md"
            trapFocus
            closeOnEscape={false}
          >
            <Tooltip label={t("Link")} withArrow>
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="dark"
                  size="md"
                  aria-label={t("Link")}
                  className={clsx({ [toolbarClasses.active]: marks.link })}
                  onClick={() => setLinkOpened((opened) => !opened)}
                >
                  <IconLink size={16} aria-hidden />
                </ActionIcon>
              </Popover.Target>
            </Tooltip>
            <Popover.Dropdown
              data-mantine-stop-propagation
              onKeyDownCapture={(event) => {
                if (event.key !== "Escape") {
                  return;
                }
                // Mantine's own Escape unmounts the focused input and leaves focus outside the modal
                setLinkOpened(false);
                if (editor && !editor.isDestroyed) {
                  editor.view.focus();
                }
              }}
            >
              {editor && (
                <LinkForm editor={editor} onDone={() => setLinkOpened(false)} />
              )}
            </Popover.Dropdown>
          </Popover>

          <EmojiPicker
            onEmojiSelect={(emoji) =>
              editor?.chain().focus().insertContent(emoji.native).run()
            }
            icon={<IconMoodSmile size={16} aria-hidden />}
            readOnly={!editor}
            actionIconProps={{ size: "md", variant: "subtle", c: "dark" }}
          />

          {textLength >= COUNTER_THRESHOLD && (
            <Text
              size="xs"
              c={textLength > ANNOUNCEMENT_MAX_TEXT_LENGTH ? "red" : "dimmed"}
              className={classes.counter}
            >
              {t("{{count}}/{{max}}", {
                count: textLength,
                max: ANNOUNCEMENT_MAX_TEXT_LENGTH,
              })}
            </Text>
          )}
        </div>

        <EditorContent editor={editor} className={classes.content} />
      </div>
    </Input.Wrapper>
  );
}

type LinkFormProps = {
  editor: Editor;
  onDone: () => void;
};

function LinkForm({ editor, onDone }: LinkFormProps) {
  const { t } = useTranslation();
  const [href, setHref] = useState<string>(
    () => editor.getAttributes("link").href ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const hasLink = editor.isActive("link");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // React bubbles the submit through the portal to the announcement form
    event.stopPropagation();
    const value = href.trim();
    if (!isSafeAnnouncementHref(value)) {
      setError(t("Enter a link starting with https://, http://, mailto: or /"));
      return;
    }
    if (editor.state.selection.empty && !hasLink) {
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: value,
          marks: [{ type: "link", attrs: { href: value } }],
        })
        .unsetMark("link")
        .run();
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: value })
        .run();
    }
    onDone();
  };

  const handleRemove = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    onDone();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="xs">
        <TextInput
          label={t("URL")}
          placeholder="https://"
          value={href}
          onChange={(event) => {
            setHref(event.currentTarget.value);
            setError(null);
          }}
          error={error}
          data-autofocus
          data-mantine-stop-propagation
        />
        <Group justify="flex-end" gap="xs">
          {hasLink && (
            <Button
              variant="default"
              size="xs"
              onClick={handleRemove}
              data-mantine-stop-propagation
            >
              {t("Remove link")}
            </Button>
          )}
          <Button type="submit" size="xs" data-mantine-stop-propagation>
            {t("Save")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
