import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Anchor, Text } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { Link, useParams } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import classes from "./mention.module.css";
import { useSharedPageQuery } from "@/features/page/queries/shared-page-query";

export default function SharedMentionView(props: NodeViewProps) {
  const { node } = props;
  const { label, entityType, entityId, slugId } = node.attrs;
  const { spaceSlug } = useParams();
  const {
    data: page,
    isLoading,
    isError,
  } = useSharedPageQuery({ pageId: entityType === "page" ? slugId : null });

  return (
    <NodeViewWrapper style={{ display: "inline" }}>
      {entityType === "user" && (
        <Text className={classes.userMention} component="span">
          @{label}
        </Text>
      )}

      {entityType === "page" && (
        <Anchor
          component={Link}
          fw={500}
          to={buildPageUrl(spaceSlug, slugId, label)}
          underline="never"
          className={classes.pageMentionLink}
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

          <span className={classes.pageMentionText}>
            {page?.title || label}
          </span>
        </Anchor>
      )}
    </NodeViewWrapper>
  );
}
