import "@/features/editor/styles/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Container,
  Group,
  Select,
  Popover,
  Stack,
  ActionIcon,
  Text,
} from "@mantine/core";
import {
  IconArrowLeft,
  IconSettings,
  IconMoodSmile,
  IconCheck,
} from "@tabler/icons-react";
import EmojiPicker from "@/components/ui/emoji-picker";
import TemplateMeta from "@/ee/template/components/template-meta";
import { useTranslation } from "react-i18next";
import { useDisclosure, useWindowEvent } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config";
import { useEditor, EditorContent } from "@tiptap/react";
import { templateExtensions } from "@/features/editor/extensions/extensions";
import {
  useUpdateTemplateMutation,
  useGetTemplateByIdQuery,
} from "../queries/template-query";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import useUserRole from "@/hooks/use-user-role";

import classes from "./template-editor.module.css";

export default function TemplateEditor() {
  const { t } = useTranslation();
  const { templateId } = useParams<{ templateId: string }>();
  const { isAdmin: isWorkspaceAdmin } = useUserRole();

  const { data: existingTemplate } = useGetTemplateByIdQuery(templateId || "");
  const { data: spaces } = useGetSpacesQuery({ limit: 100 });
  const updateMutation = useUpdateTemplateMutation();

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [draftSpaceId, setDraftSpaceId] = useState<string | null>(null);
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);

  useWindowEvent("keydown", (event) => {
    if (settingsOpened && event.key === "Escape") {
      event.stopPropagation();
      event.preventDefault();
      closeSettings();
    }
  });

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const titleRef = useRef(title);
  const iconRef = useRef(icon);
  const spaceIdRef = useRef(spaceId);
  const loadedRef = useRef(false);
  const isDirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: templateExtensions,
    content: "",
    onUpdate() {
      if (loadedRef.current) {
        markDirty();
      }
    },
  });

  // Load template data into editor
  useEffect(() => {
    if (existingTemplate && editor) {
      loadedRef.current = false;
      setTitle(existingTemplate.title || "");
      setIcon(existingTemplate.icon || null);
      setSpaceId(existingTemplate.spaceId || null);
      titleRef.current = existingTemplate.title || "";
      iconRef.current = existingTemplate.icon || null;
      spaceIdRef.current = existingTemplate.spaceId || null;
      if (existingTemplate.content) {
        editor.commands.setContent(existingTemplate.content);
      }
      requestAnimationFrame(() => {
        loadedRef.current = true;
      });
    }
  }, [existingTemplate, editor]);

  const spaceOptions = [
    ...(isWorkspaceAdmin
      ? [
          { group: t("Workspace"), items: [{ value: "", label: t("Global") }] },
        ]
      : []),
    ...(spaces?.items?.length
      ? [
          {
            group: t("Spaces"),
            items: spaces.items.map((s) => ({ value: s.id, label: s.name })),
          },
        ]
      : []),
  ];

  // Save function
  const save = useCallback(async () => {
    if (!editor || !templateId || !titleRef.current.trim()) return;
    if (!isDirtyRef.current) return;

    setSaveStatus("saving");
    try {
      await updateMutation.mutateAsync({
        templateId,
        title: titleRef.current,
        icon: iconRef.current || undefined,
        content: editor.getJSON(),
        spaceId: spaceIdRef.current,
      });
      isDirtyRef.current = false;
      setSaveStatus("saved");

      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
      savedFadeTimerRef.current = setTimeout(() => {
        setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
      }, 3000);
    } catch {
      setSaveStatus("error");
    }
  }, [editor, templateId, updateMutation]);

  // Schedule save 30s after last change
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      save();
    }, 30000);
  }, [save]);

  // Mark content as dirty and schedule save
  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
    setSaveStatus("idle");
    scheduleSave();
  }, [scheduleSave]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      titleRef.current = value;
      if (loadedRef.current) markDirty();
    },
    [markDirty],
  );

  const handleIconChange = useCallback(
    (value: string | null) => {
      setIcon(value);
      iconRef.current = value;
      if (loadedRef.current) markDirty();
    },
    [markDirty],
  );

  const handleSpaceIdChange = useCallback(
    (value: string | null) => {
      setSpaceId(value);
      spaceIdRef.current = value;
      if (loadedRef.current) markDirty();
    },
    [markDirty],
  );

  // beforeunload warning for unsaved changes
  // If user cancels (stays on page), the save fires and completes.
  // If user leaves, the save is fire-and-forget.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
        save();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [save]);

  // Save on unmount if dirty
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedFadeTimerRef.current) clearTimeout(savedFadeTimerRef.current);
      if (isDirtyRef.current) {
        save();
      }
    };
  }, [save]);

  // Manual retry for error state
  const handleRetry = useCallback(() => {
    save();
  }, [save]);

  return (
    <>
      <Helmet>
        <title>
          {t("Edit template")} - {getAppName()}
        </title>
      </Helmet>

      <div className={classes.header}>
        <Container size={900} h="100%" px={0}>
        <Group justify="space-between" h="100%" wrap="nowrap">
          <Link to="/templates" className={classes.backLink}>
            <IconArrowLeft size={16} />
            {t("Templates")}
          </Link>

          <Group gap="xs" wrap="nowrap">
            {saveStatus === "saving" && (
              <Text size="xs" c="dimmed">
                {t("Saving...")}
              </Text>
            )}
            {saveStatus === "saved" && (
              <Group gap={4} wrap="nowrap">
                <IconCheck size={14} color="var(--mantine-color-green-6)" />
                <Text size="xs" c="dimmed">
                  {t("Saved")}
                </Text>
              </Group>
            )}
            {saveStatus === "error" && (
              <Text
                size="xs"
                c="red"
                style={{ cursor: "pointer" }}
                onClick={handleRetry}
              >
                {t("Save failed. Retry")}
              </Text>
            )}

            <Popover
              width={300}
              position="bottom"
              shadow="md"
              opened={settingsOpened}
              onDismiss={closeSettings}
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  size="md"
                  onClick={() => {
                    setDraftSpaceId(spaceId);
                    openSettings();
                  }}
                >
                  <IconSettings size={18} />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="sm">
                  <Select
                    label={t("Scope")}
                    description={t("Choose which space this template belongs to")}
                    data={spaceOptions}
                    value={draftSpaceId || ""}
                    onChange={(val) =>
                      setDraftSpaceId(val || null)
                    }
                    searchable
                    size="sm"
                    comboboxProps={{ withinPortal: false }}
                  />
                  <Group justify="flex-end" mt="xs">
                    <Button
                      variant="default"
                      size="xs"
                      onClick={closeSettings}
                    >
                      {t("Cancel")}
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => {
                        const scopeChanged = draftSpaceId !== spaceId;
                        handleSpaceIdChange(draftSpaceId);
                        closeSettings();
                        if (scopeChanged) {
                          notifications.show({
                            message: t("Template scope updated"),
                          });
                        }
                      }}
                    >
                      {t("Save")}
                    </Button>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
        </Group>
        </Container>
      </div>

      <Container size={900} className={classes.editor}>
        <div className={classes.titleArea}>
          <div className={classes.emojiButton}>
            <EmojiPicker
              onEmojiSelect={(emoji: { native: string }) =>
                handleIconChange(emoji.native)
              }
              icon={
                icon ? (
                  <span className={classes.emojiIcon}>{icon}</span>
                ) : (
                  <IconMoodSmile size={20} stroke={1.5} />
                )
              }
              removeEmojiAction={() =>
                handleIconChange(null)
              }
              readOnly={false}
              actionIconProps={icon ? { size: "3rem", variant: "transparent" } : undefined}
            />
          </div>
          <input
            className={classes.titleInput}
            placeholder={t("Untitled")}
            autoFocus
            value={title}
            onChange={(e) =>
              handleTitleChange(e.currentTarget.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editor?.commands.focus("start");
              }
            }}
          />
          {existingTemplate && (
            <TemplateMeta template={existingTemplate} />
          )}
        </div>
        <EditorContent editor={editor} />
        <div style={{ paddingBottom: "20vh" }} />
      </Container>
    </>
  );
}
