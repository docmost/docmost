import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Anchor,
  Box,
  Button,
  Group,
  Popover,
  Text,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import {
  IconExternalLink,
  IconFileDescription,
  IconLink,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LinkSelector } from "./insert-link-selector";
import { buildPageUrl } from "@/features/page/page.utils";
import classes from "@/features/editor/components/subpages/subpages.module.css";
import styles from "@/features/editor/components/mention/mention.module.css";

export default function InsertLinkView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode } = props;
  const { type, pageId, url, title, icon, slugId } = node.attrs;
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const { t } = useTranslation();
  const { spaceSlug } = useParams();

  const handleSelect = (data: {
    type: "page" | "url";
    pageId?: string;
    url?: string;
    title: string;
    icon?: string;
    slugId?: string;
  }) => {
    updateAttributes({
      type: data.type,
      pageId: data.pageId,
      url: data.url,
      title: data.title,
      icon: data.icon,
      slugId: data.slugId,
    });
    setIsSelectorOpen(false);
  };

  const isEmpty = !pageId && !url;

  if (isEmpty) {
    return (
      <NodeViewWrapper className={classes.container}>
        <Popover
          opened={isSelectorOpen}
          onChange={setIsSelectorOpen}
          width={350}
          trapFocus
          position="bottom"
          withArrow
          shadow="md"
        >
          <Popover.Target>
            <Button
              variant="default"
              leftSection={<IconLink size={16} />}
              onClick={() => setIsSelectorOpen((prev) => !prev)}
              w="100%"
              justify="flex-start"
            >
              {t("Add Page Link")}
            </Button>
          </Popover.Target>
          <Popover.Dropdown p="xs">
            <LinkSelector onSelect={handleSelect} />
          </Popover.Dropdown>
        </Popover>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className={classes.container}>
      <Group gap="xs" wrap="nowrap" align="center">
        {type === "page" ? (
          <Anchor
            component={Link}
            to={buildPageUrl(spaceSlug, slugId, title)}
            className={styles.pageMentionLink}
            underline="never"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {icon ? (
              <span style={{ marginRight: "4px" }}>{icon}</span>
            ) : (
              <ActionIcon
                variant="transparent"
                color="gray"
                component="span"
                size={18}
              >
                <IconFileDescription size={18} />
              </ActionIcon>
            )}
            <span className={styles.pageMentionText}>
              {title || t("Untitled")}
            </span>
          </Anchor>
        ) : (
          <Anchor
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.pageMentionLink}
            underline="never"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <ActionIcon
              variant="transparent"
              color="info"
              component="span"
              size={18}
            >
              <IconExternalLink size={18} />
            </ActionIcon>
            <span className={styles.pageMentionText}>{title || url}</span>
          </Anchor>
        )}

        <Tooltip label={t("Edit link")}>
          <Popover
            opened={isSelectorOpen}
            onChange={setIsSelectorOpen}
            width={350}
            trapFocus
            position="bottom"
            withArrow
            shadow="md"
          >
            <Popover.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => setIsSelectorOpen((prev) => !prev)}
              >
                <IconLink size={14} />
              </ActionIcon>
            </Popover.Target>
            <Popover.Dropdown p="xs">
              <LinkSelector onSelect={handleSelect} initialUrl={url} />
            </Popover.Dropdown>
          </Popover>
        </Tooltip>

        <Tooltip label={t("Remove")}>
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={deleteNode}
          >
            <IconX size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </NodeViewWrapper>
  );
}
