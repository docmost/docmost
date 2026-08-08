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
  Button,
} from "@mantine/core";
import { useCallback, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { getIntegrationIcon } from "@/features/integration/components/integration-icons";
import { getOAuthAuthorizeUrl } from "@/features/integration/services/integration-service";
import { timeAgo } from "@/lib/time";
import { useUnfurl } from "./use-unfurl";
import { toBadgeColor } from "./badge-color";
import classes from "./integration-link-view.module.css";

const SLACK_TEXT_CLAMP_LINES = 4;

function SlackMessageCard({
  url,
  unfurlData,
}: {
  url: string;
  unfurlData: Record<string, any>;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const meta = unfurlData.metadata ?? {};
  const postedAt = meta.ts ? new Date(parseFloat(meta.ts) * 1000) : null;
  const text: string = unfurlData.description ?? "";
  const isLong =
    text.length > 280 || text.split("\n").length > SLACK_TEXT_CLAMP_LINES;

  const footer = [
    meta.replyCount
      ? `${meta.replyCount} ${meta.replyCount === 1 ? t("reply") : t("replies")}`
      : null,
    unfurlData.status,
    meta.teamName,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <NodeViewWrapper data-drag-handle="">
      <Card className={classes.card} withBorder padding="sm" radius="sm">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar
            src={unfurlData.authorAvatarUrl}
            size={28}
            radius="xl"
            style={{ flexShrink: 0 }}
          >
            {(unfurlData.author ?? "?").charAt(0)}
          </Avatar>

          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap={6} wrap="nowrap">
              <Text size="sm" fw={600} truncate>
                {unfurlData.author}
              </Text>
              {postedAt && (
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {timeAgo(postedAt)}
                </Text>
              )}
            </Group>

            {text && (
              <Text
                size="sm"
                lineClamp={expanded ? undefined : SLACK_TEXT_CLAMP_LINES}
                style={{ whiteSpace: "pre-wrap" }}
              >
                {text}
              </Text>
            )}

            {isLong && (
              <Text
                size="xs"
                fw={600}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                style={{ cursor: "pointer", width: "fit-content" }}
                onClick={() => setExpanded((v) => !v)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setExpanded((v) => !v);
                  }
                }}
              >
                {expanded ? t("show less") : t("show more")}
              </Text>
            )}

            {footer && (
              <Text size="xs" c="dimmed" truncate>
                {footer}
              </Text>
            )}
          </Stack>

          <Anchor
            href={url}
            target="_blank"
            rel="noopener"
            aria-label={t("Open in Slack")}
            style={{ flexShrink: 0, lineHeight: 0 }}
          >
            {getIntegrationIcon("slack", 18)}
          </Anchor>
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

function IntegrationLinkView(props: any) {
  const { node, updateAttributes, editor } = props;
  const { url, provider, unfurlData, status } = node.attrs;
  const { t } = useTranslation();

  const { needsConnection } = useUnfurl(url, status, updateAttributes);
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!needsConnection) return;

      setConnecting(true);
      try {
        const result = await getOAuthAuthorizeUrl({
          integrationId: needsConnection.integrationId,
          returnPath: window.location.pathname,
        });
        window.location.href = result.authorizationUrl;
      } catch (error) {
        setConnecting(false);
        notifications.show({
          message:
            error?.["response"]?.data?.message ||
            t("Failed to start OAuth connection"),
          color: "red",
        });
      }
    },
    [needsConnection, t],
  );

  if (needsConnection) {
    return (
      <NodeViewWrapper data-drag-handle="">
        <Card className={classes.card} withBorder padding="sm" radius="sm">
          <Group gap="sm" wrap="nowrap">
            <div style={{ flexShrink: 0 }}>
              {getIntegrationIcon(provider, 28)}
            </div>

            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={600} truncate>
                {needsConnection.title}
              </Text>
              {needsConnection.description && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {needsConnection.description}
                </Text>
              )}
            </Stack>

            <Button
              size="xs"
              variant="filled"
              color="dark"
              loading={connecting}
              onClick={handleConnect}
              style={{ flexShrink: 0 }}
            >
              {t("Connect to {{name}} to update", {
                name: needsConnection.integrationName,
              })}
            </Button>
          </Group>
        </Card>
      </NodeViewWrapper>
    );
  }

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

  // metadata.ts marks legacy message unfurls stored before metadata.type existed.
  const slackMeta = provider === "slack" ? unfurlData.metadata : null;
  if (slackMeta?.type === "message" || (slackMeta && !slackMeta.type && slackMeta.ts)) {
    return <SlackMessageCard url={url} unfurlData={unfurlData} />;
  }

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
            <Avatar src={unfurlData.authorAvatarUrl} size={28} radius="xl" style={{ flexShrink: 0 }} />
          ) : (
            <div style={{ flexShrink: 0 }}>{getIntegrationIcon(provider, 28)}</div>
          )}

          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" fw={600} truncate>
                {unfurlData.title}
              </Text>
              {unfurlData.status && (
                <Badge
                  size="xs"
                  variant="light"
                  color={toBadgeColor(unfurlData.statusColor)}
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
          </Stack>

          {provider && (
            <div style={{ flexShrink: 0, alignSelf: "center" }}>
              {getIntegrationIcon(provider, 18)}
            </div>
          )}
        </Group>
      </Card>
    </NodeViewWrapper>
  );
}

export default memo(IntegrationLinkView);
