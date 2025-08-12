import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Stack, Text, Anchor, ActionIcon } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { useGetSidebarPagesQuery } from "@/features/page/queries/page-query";
import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import classes from "./subpages.module.css";
import styles from "../mention/mention.module.css";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useTranslation } from "react-i18next";
import { sortPositionKeys } from "@/features/page/tree/utils/utils";

export default function SubpagesView(props: NodeViewProps) {
  const { editor } = props;
  const { spaceSlug } = useParams();
  const { t } = useTranslation();

  const currentPageId = editor.storage.pageId;
  const { data, isLoading, error } = useGetSidebarPagesQuery({
    pageId: currentPageId,
  });

  const subpages = useMemo(() => {
    if (!data?.pages) return [];
    const allPages = data.pages.flatMap((page) => page.items);
    return sortPositionKeys(allPages);
  }, [data]);

  if (isLoading) {
    return null;
  }

  if (error) {
    return (
      <NodeViewWrapper>
        <Text c="dimmed" size="md" py="md">
          {t("Failed to load subpages")}
        </Text>
      </NodeViewWrapper>
    );
  }

  if (subpages.length === 0) {
    return (
      <NodeViewWrapper>
        <div className={classes.container}>
          <Text c="dimmed" size="md" py="md">
            {t("No subpages")}
          </Text>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <div className={classes.container}>
        <Stack gap={5}>
          {subpages.map((page) => (
            <Anchor
              key={page.id}
              component={Link}
              fw={500}
              to={buildPageUrl(spaceSlug, page.slugId, page.title)}
              underline="never"
              className={styles.pageMentionLink}
              draggable={false}
            >
              {page?.icon ? (
                <span style={{ marginRight: "4px" }}>{page.icon}</span>
              ) : (
                <ActionIcon
                  variant="transparent"
                  color="gray"
                  component="span"
                  size={18}
                  style={{ verticalAlign: "text-bottom" }}
                >
                  <IconFileDescription size={18} />
                </ActionIcon>
              )}

              <span className={styles.pageMentionText}>
                {page?.title || t("untitled")}
              </span>
            </Anchor>
          ))}
        </Stack>
      </div>
    </NodeViewWrapper>
  );
}
