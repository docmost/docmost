import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import React, { useMemo, useCallback, useState, useEffect } from "react";
import clsx from "clsx";
import {
  ActionIcon,
  Button,
  Card,
  FocusTrap,
  Group,
  Popover,
  Text,
  TextInput,
  Center,
  Stack,
} from "@mantine/core";
import { IconEdit, IconArrowsMove, IconArrowsMaximize, IconArrowsMinimize, IconPlayerPlay } from "@tabler/icons-react";
import { z } from "zod";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import {
  getEmbedProviderById,
  getEmbedUrlAndProvider,
  sanitizeUrl,
} from "@docmost/editor-ext";
import { ResizableWrapper } from "../common/resizable-wrapper";
import classes from "./embed-view.module.css";

const schema = z.object({
  url: z
    .string()
    .trim()
    .url({ message: i18n.t("Please enter a valid url") }),
});

export default function EmbedView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected, updateAttributes, editor } = props;
  const { src, provider, height: nodeHeight, width: nodeWidth, resizable = true, lazyLoad = false } = node.attrs;

  const [isResizable, setIsResizable] = useState<boolean>(resizable);
  const [shouldLoadIframe, setShouldLoadIframe] = useState<boolean>(!lazyLoad);

  const embedUrl = useMemo(() => {
    if (src) {
      return getEmbedUrlAndProvider(src).embedUrl;
    }
    return null;
  }, [src]);

  const embedForm = useForm<{ url: string }>({
    initialValues: {
      url: "",
    },
    validate: zodResolver(schema),
  });

  const handleResize = useCallback(
    (newHeight: number, newWidth?: string) => {
      const updates: any = { height: newHeight };
      if (newWidth !== undefined) {
        updates.width = newWidth;
      }
      updateAttributes(updates);
    },
    [updateAttributes],
  );

  useEffect(() => {
    setIsResizable(!!resizable);
  }, [resizable]);

  useEffect(() => {
    setShouldLoadIframe(!lazyLoad);
  }, [lazyLoad]);

  const handleLoadIframe = useCallback(() => {
    setShouldLoadIframe(true);
  }, []);

  async function onSubmit(data: { url: string }) {
    if (!editor.isEditable) {
      return;
    }

    if (provider) {
      const embedProvider = getEmbedProviderById(provider);
      if (embedProvider.id === "iframe") {
        updateAttributes({ src: sanitizeUrl(data.url) });
        return;
      }
      if (embedProvider.regex.test(data.url)) {
        updateAttributes({ src: sanitizeUrl(data.url) });
      } else {
        notifications.show({
          message: t("Invalid {{provider}} embed link", {
            provider: embedProvider.name,
          }),
          position: "top-right",
          color: "red",
        });
      }
    }
  }

  return (
    <NodeViewWrapper data-drag-handle>
      {embedUrl ? (
        <div className={classes.embedContainer}>
          {!shouldLoadIframe ? (
            <Card
              radius="md"
              p="lg"
              withBorder
              className={clsx(classes.embedPlaceholder, {
                "ProseMirror-selectednode": selected,
              })}
              style={{ 
                height: nodeHeight || 480,
                width: nodeWidth || "100%"
              }}
            >
              <Center style={{ height: "100%" }}>
                <Stack align="center" gap="md">
                  <ActionIcon
                    variant="filled"
                    size="xl"
                    radius="xl"
                    color="blue"
                  >
                    <IconPlayerPlay size={24} />
                  </ActionIcon>
                  <Text size="lg" fw={500} ta="center">
                    {t("Click to load {{provider}}", {
                      provider: getEmbedProviderById(provider)?.name || provider,
                    })}
                  </Text>
                  <Button 
                    onClick={handleLoadIframe}
                    variant="filled"
                    leftSection={<IconPlayerPlay size={16} />}
                  >
                    {t("Load Embed")}
                  </Button>
                </Stack>
              </Center>
            </Card>
          ) : isResizable ? (
            <ResizableWrapper
              initialHeight={nodeHeight || 480}
              initialWidth={nodeWidth || "100%"}
              minHeight={200}
              maxHeight={1200}
              minWidth="20%"
              maxWidth="100%"
              onResize={handleResize}
              isEditable={editor.isEditable}
              direction="both"
              className={clsx(classes.embedWrapper, {
                "ProseMirror-selectednode": selected,
              })}
            >
              <iframe
                className={classes.embedIframe}
                src={sanitizeUrl(embedUrl)}
                allow="encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                allowFullScreen
                frameBorder="0"
              />
            </ResizableWrapper>
          ) : (
            <div
              className={clsx(classes.embedWrapper, classes.nonResizable, {
                "ProseMirror-selectednode": selected,
              })}
              style={{ 
                height: nodeHeight || 480,
                width: nodeWidth || "100%"
              }}
            >
              <iframe
                className={classes.embedIframe}
                src={sanitizeUrl(embedUrl)}
                allow="encrypted-media"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                allowFullScreen
                frameBorder="0"
              />
            </div>
          )}
        </div>
      ) : (
        <Popover
          width={300}
          position="bottom"
          withArrow
          shadow="md"
          disabled={!editor.isEditable}
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
                <ActionIcon variant="transparent" color="gray">
                  <IconEdit size={18} />
                </ActionIcon>

                <Text component="span" size="lg" c="dimmed">
                  {t("Embed {{provider}}", {
                    provider: getEmbedProviderById(provider)?.name,
                  })}
                </Text>
              </div>
            </Card>
          </Popover.Target>
          <Popover.Dropdown bg="var(--mantine-color-body)">
            <form onSubmit={embedForm.onSubmit(onSubmit)}>
              <FocusTrap active={true}>
                <TextInput
                  placeholder={t("Enter {{provider}} link to embed", {
                    provider: getEmbedProviderById(provider).name,
                  })}
                  key={embedForm.key("url")}
                  {...embedForm.getInputProps("url")}
                  data-autofocus
                />
              </FocusTrap>

              <Group justify="center" mt="xs">
                <Button type="submit">{t("Embed link")}</Button>
              </Group>
            </form>
          </Popover.Dropdown>
        </Popover>
      )}
    </NodeViewWrapper>
  );
}
