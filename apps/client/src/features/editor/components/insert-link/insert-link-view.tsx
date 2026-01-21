import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Popover,
  Tooltip,
} from "@mantine/core";
import { Link, useParams } from "react-router-dom";
import {
  IconExternalLink,
  IconFileDescription,
  IconLink,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LinkSelector } from "./insert-link-selector";
import { buildPageUrl } from "@/features/page/page.utils";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import classes from "./insert-link-view.module.css";
import styles from "@/features/editor/components/mention/mention.module.css";

export default function InsertLinkView(props: NodeViewProps) {
  const { node, updateAttributes, deleteNode } = props;
  const { type, pageId, url, title, icon, slugId, manualTitle } = node.attrs;
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const [isEditable, setIsEditable] = useState(props.editor.isEditable);

  const { data: page } = usePageQuery({
    pageId: type === "page" ? extractPageSlugId(slugId) : undefined,
  });

  useEffect(() => {
    if (type === "page" && page && !manualTitle) {
      if (page.title !== title || page.icon !== icon) {
        updateAttributes({
          title: page.title,
          icon: page.icon,
        });
      }
    }
  }, [page, title, icon, manualTitle, type, updateAttributes]);

  useEffect(() => {
    const update = () => setIsEditable(props.editor.isEditable);
    props.editor.on("transaction", update);
    props.editor.on("update", update);

    return () => {
      props.editor.off("transaction", update);
      props.editor.off("update", update);
    };
  }, [props.editor]);

  const handleSelect = (data: {
    type: "page" | "url";
    pageId?: string;
    url?: string;
    title: string;
    icon?: string;
    slugId?: string;
    manualTitle?: boolean;
  }) => {
    updateAttributes({
      type: data.type,
      pageId: data.pageId,
      url: data.url,
      title: data.title,
      icon: data.icon,
      slugId: data.slugId,
      manualTitle: data.manualTitle,
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
            <span className={styles.pageMentionText} style={{ border: "none" }}>
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
            <span className={styles.pageMentionText} style={{ border: "none" }}>
              {title || url}
            </span>
          </Anchor>
        )}

        {isEditable && (
          <Group gap="xs" className={classes.actions}>
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
        )}
      </Group>
    </NodeViewWrapper>
  );
}
