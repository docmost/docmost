import "@/features/editor/styles/index.css";
import "../components/template-variable.css";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Container,
  Group,
  Select,
  Popover,
  Stack,
  ActionIcon,
  Text,
  Textarea,
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
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { EditorSpaceContext } from "@/features/editor/components/recently-updated/editor-space-context";
import { getTemplateExtensions } from "@/features/editor/extensions/extensions";
import { PagesByLabelContext } from "@/features/editor/components/pages-by-label/pages-by-label-context";
import { TemplatePlaceholderPopover } from "@/ee/template/components/template-placeholder-popover";
import {
  useUpdateTemplateMutation,
  useGetTemplateByIdQuery,
} from "../queries/template-query";
import {
  useGetSpacesQuery,
  useUnlistedSpaceQuery,
} from "@/features/space/queries/space-query";
import { includeSpace } from "@/features/space/space.utils";
import useUserRole from "@/hooks/use-user-role";
import { useAtom, useAtomValue } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { FixedToolbar } from "@/features/editor/components/fixed-toolbar/fixed-toolbar";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { EditorAiMenu } from "@/ee/ai/components/editor/ai-menu/ai-menu";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import { TableHandlesLayer } from "@/features/editor/components/table/handle/table-handles-layer";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";

import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";

import { lightboxRequestAtom } from "@/features/editor/atoms/editor-atoms";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import PdfMenu from "@/features/editor/components/pdf/pdf-menu.tsx";
import ExcalidrawMenu from "@/features/editor/components/excalidraw/excalidraw-menu-lazy";
import DrawioMenu from "@/features/editor/components/drawio/drawio-menu";
import { IntegrationPasteMenu } from "@/features/editor/components/integration-link/integration-paste-menu.tsx";
import { LinkPasteMenu } from "@/features/editor/components/link-preview/link-paste-menu.tsx";
import LightboxView, {
  getLightboxClickRequest,
} from "@/features/editor/components/common/lightbox-view";

import classes from "./template-editor.module.css";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { useExportDisabled } from "@/ee/security/hooks/use-export-disabled";
import { useDisablePrint } from "@/ee/security/hooks/use-disable-print";
import { withoutUploadPlaceholders } from "@/ee/template/template.utils";

export default function TemplateEditor() {
  const { t } = useTranslation();
  const { templateId } = useParams<{ templateId: string }>();
  const { isAdmin: isWorkspaceAdmin } = useUserRole();
  const user = useAtomValue(userAtom);
  const editorToolbarEnabled =
    user?.settings?.preferences?.editorToolbar ?? false;

  const { data: existingTemplate } = useGetTemplateByIdQuery(templateId || "");
  const { exportDisabledLabel } = useExportDisabled(existingTemplate?.spaceId);
  useDisablePrint(exportDisabledLabel);
  const { data: spaces } = useGetSpacesQuery({ limit: 100 });
  const updateMutation = useUpdateTemplateMutation();
  const updateMutationRef = useRef(updateMutation.mutateAsync);
  updateMutationRef.current = updateMutation.mutateAsync;

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [draftSpaceId, setDraftSpaceId] = useState<string | null>(null);
  const { data: templateSpace } = useUnlistedSpaceQuery(
    spaceId,
    spaces?.items,
  );
  const [settingsOpened, { open: openSettings, close: closeSettings }] =
    useDisclosure(false);
  const [placeholderOpened, { open: openPlaceholder, close: closePlaceholder }] =
    useDisclosure(false);
  const extensions = useMemo(
    () => getTemplateExtensions(openPlaceholder),
    [openPlaceholder],
  );
  const savePlaceholderRef = useRef<(() => void) | null>(null);

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
  const loadedTemplateIdRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editorRef = useRef<Editor | null>(null);
  const [lightboxRequest, setLightboxRequest] = useAtom(lightboxRequestAtom);

  useEffect(() => {
    return () => setLightboxRequest(null);
  }, [setLightboxRequest]);

  const editor = useEditor({
    extensions,
    content: "",
    textDirection: "auto",
    editorProps: {
      scrollThreshold: 80,
      scrollMargin: 80,
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
            const slashCommand = document.querySelector("#slash-command");
            if (slashCommand) {
              return true;
            }
          }
        },
      },
      handleDoubleClickOn: (_view, _pos, node) => {
        const request = getLightboxClickRequest(node);
        if (!request) return false;

        setLightboxRequest(request);
        return true;
      },
      handlePaste: (_view, event) => {
        if (!editorRef.current || !templateId) return false;

        return handlePaste(
          editorRef.current,
          event,
          { templateId },
          user?.id,
        );
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (!editorRef.current || !templateId) return false;

        return handleFileDrop(editorRef.current, event, moved, { templateId });
      },
    },
    onCreate({ editor }) {
      // @ts-ignore
      editor.storage.templateId = templateId;
      editorRef.current = editor;
    },
    onUpdate() {
      if (loadedRef.current) {
        markDirty();
      }
    },
  });

  useLayoutEffect(() => {
    if (editor && !editor.isDestroyed) {
      // @ts-ignore
      editor.storage.templateId = templateId;
      editorRef.current = editor;
    }
  }, [editor, templateId]);

  // Load template data into editor
  useEffect(() => {
    if (
      existingTemplate &&
      editor &&
      !editor.isDestroyed &&
      loadedTemplateIdRef.current !== existingTemplate.id
    ) {
      loadedTemplateIdRef.current = existingTemplate.id;
      loadedRef.current = false;
      closePlaceholder();
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
  }, [existingTemplate, editor, closePlaceholder]);

  const scopeSpaces = includeSpace(spaces?.items ?? [], templateSpace);

  const spaceOptions = [
    ...(isWorkspaceAdmin
      ? [
          { group: t("Workspace"), items: [{ value: "", label: t("Global") }] },
        ]
      : []),
    ...(scopeSpaces.length
      ? [
          {
            group: t("Spaces"),
            items: scopeSpaces.map((s) => ({ value: s.id, label: s.name })),
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
      await updateMutationRef.current({
        templateId,
        title: titleRef.current,
        icon: iconRef.current || undefined,
        content: withoutUploadPlaceholders(editor.getJSON()),
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
  }, [editor, templateId]);

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
      savePlaceholderRef.current?.();
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
      savePlaceholderRef.current?.();
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
      <DocumentTitle title={t("Edit template")} />

      {editorToolbarEnabled && editor && (
        <FixedToolbar editor={editor} templateMode />
      )}

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
                  aria-label={t("Template settings")}
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
          <Textarea
            autosize
            variant="unstyled"
            classNames={{ input: classes.titleInput }}
            placeholder={t("Untitled")}
            autoFocus
            value={title}
            onChange={(e) =>
              handleTitleChange(e.currentTarget.value.replace(/[\r\n]+/g, " "))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (editor && !editor.isDestroyed)
                  editor.commands.focus("start");
              }
            }}
          />
          {existingTemplate && (
            <TemplateMeta template={existingTemplate} />
          )}
        </div>
        <PagesByLabelContext.Provider value={{ spaceId }}>
          <EditorSpaceContext.Provider value={spaceId ?? undefined}>
            <EditorContent
              editor={editor}
              data-editing-placeholder={placeholderOpened || undefined}
            />
          </EditorSpaceContext.Provider>
        </PagesByLabelContext.Provider>
        {editor && (
          <>
            {placeholderOpened ? (
              <TemplatePlaceholderPopover
                editor={editor}
                onClose={closePlaceholder}
                saveRef={savePlaceholderRef}
              />
            ) : (
              <EditorBubbleMenu editor={editor} templateMode />
            )}
            <EditorAiMenu editor={editor} />
            <EditorLinkMenu editor={editor} />
            <TableMenu editor={editor} />
            <TableHandlesLayer editor={editor} />
            <CalloutMenu editor={editor} />
            <ColumnsMenu editor={editor} />
            <ImageMenu editor={editor} />
            <VideoMenu editor={editor} />
            <PdfMenu editor={editor} />
            <ExcalidrawMenu editor={editor} />
            <DrawioMenu editor={editor} />
            <IntegrationPasteMenu editor={editor} />
            <LinkPasteMenu editor={editor} />
            <LightboxView
              editor={editor}
              open={!!lightboxRequest}
              src={lightboxRequest?.src ?? ""}
              type={lightboxRequest?.type ?? "image"}
              onClose={() => setLightboxRequest(null)}
            />
          </>
        )}
        <div
          onClick={() => {
            if (editor && !editor.isDestroyed) editor.commands.focus("end");
          }}
          style={{ paddingBottom: "20vh" }}
        />
      </Container>
    </>
  );
}
