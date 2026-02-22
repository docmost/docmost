import { NodeViewWrapper } from "@tiptap/react";
import {
  Card,
  Group,
  Text,
  Badge,
  Avatar,
  Skeleton,
  Anchor,
  Stack,
} from "@mantine/core";
import { useEffect, useCallback, memo } from "react";
import { unfurlUrl } from "@/features/integration/services/integration-service";
import classes from "./integration-link-view.module.css";

const providerIcons: Record<string, string> = {
  github: "https://github.githubassets.com/favicons/favicon-dark.svg",
  gitlab: "https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8571da3c2571592f63571e0c5571.png",
  jira: "https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/favicon.png",
  linear: "https://linear.app/favicon.ico",
};

function IntegrationLinkView(props: any) {
  const { node, updateAttributes, editor } = props;
  const { url, provider, unfurlData, status } = node.attrs;

  const doUnfurl = useCallback(async () => {
    if (status !== "pending" || !url) return;

    try {
      const result = await unfurlUrl({ url });
      if (result) {
        updateAttributes({
          unfurlData: result,
          status: "loaded",
        });
      } else {
        updateAttributes({ status: "error" });
      }
    } catch {
      updateAttributes({ status: "error" });
    }
  }, [url, status, updateAttributes]);

  useEffect(() => {
    if (status === "pending") {
      doUnfurl();
    }
  }, [status, doUnfurl]);

  if (status === "pending") {
    return (
      <NodeViewWrapper data-drag-handle="">
        <Card className={classes.card} withBorder padding="sm" radius="sm">
          <Group gap="sm">
            <Skeleton circle height={24} />
            <Stack gap={4} style={{ flex: 1 }}>
              <Skeleton height={14} width="60%" />
              <Skeleton height={10} width="80%" />
            </Stack>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

  if (status === "error" || !unfurlData) {
    return (
      <NodeViewWrapper data-drag-handle="">
        <Card className={classes.card} withBorder padding="sm" radius="sm">
          <Anchor href={url} target="_blank" rel="noopener" size="sm">
            {url}
          </Anchor>
        </Card>
      </NodeViewWrapper>
    );
  }

  const iconUrl = providerIcons[provider] ?? undefined;

  return (
    <NodeViewWrapper data-drag-handle="">
      <Card
        className={classes.card}
        withBorder
        padding="sm"
        radius="sm"
        component="a"
        href={url}
        target="_blank"
        rel="noopener"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <Group gap="sm" wrap="nowrap">
          {unfurlData.authorAvatarUrl ? (
            <Avatar src={unfurlData.authorAvatarUrl} size={28} radius="xl" />
          ) : iconUrl ? (
            <Avatar src={iconUrl} size={28} radius="sm" />
          ) : null}

          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={600} truncate>
                {unfurlData.title}
              </Text>
              {unfurlData.status && (
                <Badge
                  size="xs"
                  variant="light"
                  color={unfurlData.statusColor ?? "gray"}
                  style={{ flexShrink: 0 }}
                >
                  {unfurlData.status}
                </Badge>
              )}
            </Group>

            {unfurlData.description && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                {unfurlData.description}
              </Text>
            )}

            <Group gap="xs">
              {iconUrl && (
                <Avatar src={iconUrl} size={14} radius="sm" />
              )}
              <Text size="xs" c="dimmed">
                {unfurlData.provider}
              </Text>
              {unfurlData.author && (
                <Text size="xs" c="dimmed">
                  · {unfurlData.author}
                </Text>
              )}
            </Group>
          </Stack>
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

export default memo(IntegrationLinkView);
