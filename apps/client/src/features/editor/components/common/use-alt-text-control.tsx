import React, { useCallback, useEffect, useState } from "react";
import { Editor } from "@tiptap/react";
import {
  ActionIcon,
  Button,
  Group,
  Paper,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { IconAlt } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

const ALT_MAX_LENGTH = 300;

function sanitizeAlt(value: string): string {
  return value
    .replace(/[\\\[\]!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type UseAltTextControlArgs = {
  editor: Editor;
  nodeName: string;
  currentAlt: string;
};

export function useAltTextControl({
  editor,
  nodeName,
  currentAlt,
}: UseAltTextControlArgs) {
  const { t } = useTranslation();
  const [showInput, setShowInput] = useState(false);
  const [draft, setDraft] = useState("");

  const open = useCallback(() => {
    setDraft(currentAlt || "");
    setShowInput(true);
  }, [currentAlt]);

  useEffect(() => {
    const handler = () => {
      if (!editor.isActive(nodeName)) {
        setShowInput(false);
      }
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor, nodeName]);

  const cancel = useCallback(() => {
    setShowInput(false);
  }, []);

  const save = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .updateAttributes(nodeName, { alt: sanitizeAlt(draft) || undefined })
      .run();
    setShowInput(false);
  }, [editor, nodeName, draft]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  const button = (
    <Tooltip position="top" label={t("Alt text")} withinPortal={false}>
      <ActionIcon
        onClick={open}
        size="lg"
        aria-label={t("Alt text")}
        variant="subtle"
      >
        <IconAlt size={18} />
      </ActionIcon>
    </Tooltip>
  );

  const panel = showInput ? (
    <Paper
      withBorder
      shadow="md"
      radius={6}
      p="sm"
      w={320}
      style={{ position: "relative", zIndex: 100 }}
    >
      <Text size="sm" fw={600} mb={2}>
        {t("Alt text")}
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        {t("Describe this for accessibility.")}
      </Text>
      <Textarea
        size="xs"
        placeholder={t("Add a description")}
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        autoFocus
        autosize
        minRows={2}
        maxRows={5}
        maxLength={ALT_MAX_LENGTH}
      />
      <Group justify="space-between" align="center" mt="xs" wrap="nowrap">
        <Text size="xs" c="dimmed">
          {draft.length}/{ALT_MAX_LENGTH}
        </Text>
        <Group gap="xs">
          <Button size="compact-xs" variant="default" onClick={cancel}>
            {t("Cancel")}
          </Button>
          <Button size="compact-xs" onClick={save}>
            {t("Save")}
          </Button>
        </Group>
      </Group>
    </Paper>
  ) : null;

  return { button, panel, isEditing: showInput };
}
