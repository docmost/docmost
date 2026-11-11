import { NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import React, { useMemo, useCallback, useState } from "react";
import clsx from "clsx";
import {
  ActionIcon,
  Button,
  Card,
  FocusTrap,
  Group,
  Menu,
  Popover,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconCheck,
  IconDots,
  IconEdit,
  IconExternalLink,
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
  IconLink,
  IconPencil,
  IconX,
} from "@tabler/icons-react";
import { z } from "zod/v4";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import {
  getEmbedProviderById,
  getEmbedUrlAndProvider,
  sanitizeUrl,
} from "@docmost/editor-ext";
import { RadioMenuItem } from "@/components/ui/radio-menu-item";
import { ResizableWrapper } from "../common/resizable-wrapper";
import { EmbedProviderIcon } from "./embed-provider-icon";
import classes from "./embed-view.module.css";

const schema = z.object({
  url: z.url({ message: i18n.t("Please enter a valid url") }).trim(),
});

const ALIGN_OPTIONS = [
  { value: "left", label: "Align left", icon: IconLayoutAlignLeft },
  { value: "center", label: "Align center", icon: IconLayoutAlignCenter },
  { value: "right", label: "Align right", icon: IconLayoutAlignRight },
];

export default function EmbedView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected, updateAttributes, deleteNode, editor } = props;
  const {
    src,
    provider,
    align,
    width: nodeWidth,
    height: nodeHeight,
  } = node.attrs;
  const clipboard = useClipboard();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingLink, setEditingLink] = useState(false);

  const isEditable = useEditorState({
    editor,
    selector: ({ editor }) => editor?.isEditable ?? false,
  });

  const embed = useMemo(
    () => (src ? getEmbedUrlAndProvider(src) : null),
    [src],
  );

  // Imported embeds store the provider name, not its id.
  const embedProvider =
    getEmbedProviderById(provider) ??
    getEmbedProviderById(embed?.providerId ?? "iframe");

  const handleResize = useCallback(
    (newWidth: number, newHeight: number) => {
      updateAttributes({ width: newWidth, height: newHeight });
    },
    [updateAttributes],
  );

  function saveLink(url: string): boolean {
    if (!editor.isEditable) {
      return false;
    }

    if (embedProvider.id !== "iframe" && !embedProvider.regex.test(url)) {
      notifications.show({
        message: t("Invalid {{provider}} embed link", {
          provider: embedProvider.name,
        }),
        position: "top-right",
        color: "red",
      });
      return false;
    }

    updateAttributes({ src: sanitizeUrl(url) });
    return true;
  }

  function handleCopyLink() {
    clipboard.copy(src);
    notifications.show({ message: t("Link copied") });
  }

  const linkPlaceholder = t("Enter {{provider}} link to embed", {
    provider: embedProvider.name,
  });

  return (
    <NodeViewWrapper data-drag-handle className={classes.embedNodeView}>
      {embed ? (
        <div className={classes.embedContainer} data-align={align}>
          <div
            className={classes.frame}
            data-menu-open={menuOpen || editingLink ? "true" : "false"}
          >
            <Popover
              opened={editingLink}
              onChange={setEditingLink}
              width={300}
              position="bottom-end"
              withArrow
              withRoles={false}
              shadow="md"
            >
              <Popover.Target>
                <div
                  className={classes.controls}
                  contentEditable={false}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Button
                    component="a"
                    href={sanitizeUrl(src)}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="default"
                    size="compact-xs"
                    leftSection={
                      <EmbedProviderIcon
                        providerId={embed.providerId}
                        size={14}
                      />
                    }
                    rightSection={<IconExternalLink size={12} />}
                    aria-label={t("Open {{name}}", { name: embed.label })}
                  >
                    {embed.label}
                  </Button>

                  <Tooltip label={t("Copy link")}>
                    <ActionIcon
                      variant="default"
                      size="sm"
                      onClick={handleCopyLink}
                      aria-label={t("Copy link for {{name}}", {
                        name: embed.label,
                      })}
                    >
                      <IconLink size={14} />
                    </ActionIcon>
                  </Tooltip>

                  {isEditable && (
                    <Menu
                      position="bottom-end"
                      withinPortal
                      onChange={setMenuOpen}
                    >
                      <Menu.Target>
                        <ActionIcon
                          variant="default"
                          size="sm"
                          aria-label={t("Embed options for {{name}}", {
                            name: embed.label,
                          })}
                        >
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconPencil size={14} />}
                          onClick={() => setEditingLink(true)}
                        >
                          {t("Edit link")}
                        </Menu.Item>
                        <Menu.Divider />
                        {ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
                          <Menu.Item
                            key={value}
                            component={RadioMenuItem}
                            aria-checked={align === value}
                            leftSection={<Icon size={14} />}
                            rightSection={
                              align === value ? (
                                <IconCheck size={14} aria-hidden />
                              ) : null
                            }
                            onClick={() => updateAttributes({ align: value })}
                          >
                            {t(label)}
                          </Menu.Item>
                        ))}
                        <Menu.Divider />
                        <Menu.Item
                          leftSection={<IconX size={14} />}
                          onClick={() => deleteNode()}
                        >
                          {t("Remove from page")}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </div>
              </Popover.Target>
              <Popover.Dropdown
                bg="var(--mantine-color-body)"
                aria-label={t("Edit link")}
              >
                <EmbedLinkForm
                  initialUrl={src}
                  placeholder={linkPlaceholder}
                  submitLabel={t("Save")}
                  onSubmit={(url) => {
                    if (saveLink(url)) setEditingLink(false);
                  }}
                />
              </Popover.Dropdown>
            </Popover>

            <ResizableWrapper
              initialWidth={nodeWidth || 800}
              initialHeight={nodeHeight || 600}
              minWidth={200}
              maxWidth={1200}
              minHeight={200}
              maxHeight={1200}
              onResize={handleResize}
              isEditable={isEditable}
              selected={selected}
              className={clsx(classes.embedWrapper, {
                "ProseMirror-selectednode": selected,
              })}
            >
              <iframe
                className={classes.embedIframe}
                src={sanitizeUrl(embed.embedUrl)}
                allow="encrypted-media; clipboard-read; clipboard-write; picture-in-picture;"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                allowFullScreen
                frameBorder="0"
              />
            </ResizableWrapper>
          </div>
        </div>
      ) : (
        <Popover
          width={300}
          position="bottom"
          withArrow
          shadow="md"
          disabled={!isEditable}
        >
          <Popover.Target>
            <Card
              radius="md"
              p="xs"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              withBorder
              className={clsx(selected ? "ProseMirror-selectednode" : "")}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  aria-label={t("Edit embed")}
                >
                  <IconEdit size={18} />
                </ActionIcon>

                <Text component="span" size="lg" c="dimmed">
                  {t("Embed {{provider}}", {
                    provider: embedProvider.name,
                  })}
                </Text>
              </div>
            </Card>
          </Popover.Target>
          <Popover.Dropdown bg="var(--mantine-color-body)">
            <EmbedLinkForm
              placeholder={linkPlaceholder}
              submitLabel={t("Embed link")}
              onSubmit={saveLink}
            />
          </Popover.Dropdown>
        </Popover>
      )}
    </NodeViewWrapper>
  );
}

type EmbedLinkFormProps = {
  initialUrl?: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (url: string) => void;
};

function EmbedLinkForm({
  initialUrl = "",
  placeholder,
  submitLabel,
  onSubmit,
}: EmbedLinkFormProps) {
  const form = useForm<{ url: string }>({
    initialValues: { url: initialUrl },
    validate: zod4Resolver(schema),
  });

  return (
    <form onSubmit={form.onSubmit(({ url }) => onSubmit(url))}>
      <FocusTrap active={true}>
        <TextInput
          placeholder={placeholder}
          key={form.key("url")}
          {...form.getInputProps("url")}
          data-autofocus
        />
      </FocusTrap>

      <Group justify="center" mt="xs">
        <Button type="submit">{submitLabel}</Button>
      </Group>
    </form>
  );
}
