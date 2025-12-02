import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Anchor, Text } from "@mantine/core";
import { IconFileDescription } from "@tabler/icons-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import {
  buildPageUrl,
  buildSharedPageUrl,
} from "@/features/page/page.utils.ts";
import classes from "./mention.module.css";

const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export default function MentionView(props: NodeViewProps) {
  const { node } = props;
  const { label, entityType, entityId, slugId, anchorSlug, anchorText } = node.attrs;
  const { spaceSlug } = useParams();
  const { shareId } = useParams();
  const {
    data: page,
    isLoading,
    isError,
  } = usePageQuery({ pageId: entityType === "page" ? slugId : null });

  const location = useLocation();
  const isShareRoute = location.pathname.startsWith("/share");

  const baseShareSlugUrl = buildSharedPageUrl({
    shareId,
    pageSlugId: slugId,
    pageTitle: label,
  });

  const shareSlugUrl = anchorSlug ? `${baseShareSlugUrl}#${anchorSlug}` : baseShareSlugUrl;
  const pageUrl = buildPageUrl(spaceSlug, slugId, label);
  const pageUrlWithAnchor = anchorSlug ? `${pageUrl}#${anchorSlug}` : pageUrl;

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
          to={
            isShareRoute ? shareSlugUrl : pageUrlWithAnchor
          }
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
            {anchorText && (
              <span className={classes.anchorText}>
                {'#'}{truncateText(anchorText)}
              </span>
            )}
          </span>
        </Anchor>
      )}
    </NodeViewWrapper>
  );
}
