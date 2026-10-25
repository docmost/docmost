import { NodeViewWrapper } from "@tiptap/react";
import {
  Avatar,
  Badge,
  Button,
  Group,
  HoverCard,
  Stack,
  Text,
} from "@mantine/core";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { notifications } from "@mantine/notifications";
import { describeIntegrationLink, isHttpUrl } from "@docmost/editor-ext";
import { getIntegrationIcon } from "@/features/integration/components/integration-icons";
import { getOAuthAuthorizeUrl } from "@/features/integration/services/integration-service";
import { useUnfurl } from "./use-unfurl";
import { badgeTextColor, toBadgeColor } from "./badge-color";
import classes from "./integration-mention-view.module.css";

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function IntegrationMentionView(props: any) {
  const { editor, getPos, node } = props;
  const { url, provider } = node.attrs;
  const safeUrl = isHttpUrl(url) ? url : "";
  const { t } = useTranslation();

  const unfurl = useUnfurl(safeUrl);
  const data = unfurl.state === "loaded" ? unfurl.data : null;
  const needsConnection =
    unfurl.state === "needsConnection" ? unfurl.needsConnection : null;
  const [connecting, setConnecting] = useState(false);

  const selectForEditing = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      if (!editor.isEditable || event.metaKey || event.ctrlKey) return;

      const pos = getPos();
      if (typeof pos !== "number") return;

      event.preventDefault();
      event.stopPropagation();
      editor
        .chain()
        .focus(undefined, { scrollIntoView: false })
        .setNodeSelection(pos)
        .run();
    },
    [editor, getPos],
  );

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
  const meta = data?.metadata ?? {};
  const isSlackMessage =
    provider === "slack" &&
    (meta.type === "message" || (!meta.type && meta.ts));
  const issueNumber = meta.iid ?? meta.number;
  const typeLabel =
    meta.type === "project"
      ? t("Project")
      : meta.type === "initiative"
        ? t("Initiative")
        : null;

  const statusBadge = data?.status ? (
    <Badge
      size="xs"
      variant="light"
      color={toBadgeColor(data.statusColor)}
      c={badgeTextColor(toBadgeColor(data.statusColor))}
      className={classes.mentionIcon}
    >
      {data.status}
    </Badge>
  ) : null;

  let content;
  if (!data) {
    // Without unfurl data, describe the link from its url.
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <span className={classes.mentionText}>
          {needsConnection?.title ??
            describeIntegrationLink(safeUrl)?.title ??
            (safeUrl ? shortUrl(safeUrl) : url)}
        </span>
      </>
    );
  } else if (isSlackMessage) {
    content = (
      <>
        <Avatar
          src={data.authorAvatarUrl}
          size={16}
          radius="xl"
          className={classes.mentionIcon}
        >
          {(data.author ?? "?").charAt(0)}
        </Avatar>
        {data.author && (
          <span className={classes.mentionMeta}>{data.author}</span>
        )}
        <span className={classes.mentionText}>
          {(data.description ?? "").split("\n")[0] || shortUrl(url)}
        </span>
        {getIntegrationIcon("slack", 14)}
        {data.status && (
          <Badge
            size="xs"
            variant="light"
            color="gray"
            c={badgeTextColor("gray")}
            tt="none"
            className={classes.mentionIcon}
          >
            {data.status}
          </Badge>
        )}
      </>
    );
  } else if (meta.issueKey) {
    // Jira issue
    content = (
      <>
        {meta.issueTypeIconUrl ? (
          <img
            src={meta.issueTypeIconUrl}
            width={14}
            height={14}
            alt=""
            className={classes.mentionIcon}
          />
        ) : (
          getIntegrationIcon(provider, 14)
        )}
        <span className={classes.mentionMeta}>{meta.issueKey}</span>
        <span className={classes.mentionText}>{data.title}</span>
        {statusBadge}
        {meta.issueTypeIconUrl && getIntegrationIcon(provider, 14)}
      </>
    );
  } else if (issueNumber) {
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <span className={classes.mentionMeta}>#{issueNumber}</span>
        <span className={classes.mentionText}>{data.title}</span>
        {statusBadge}
      </>
    );
  } else if (typeLabel) {
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <span className={classes.mentionMeta}>{typeLabel}</span>
        <span className={classes.mentionText}>{data.title}</span>
        {statusBadge}
      </>
    );
  } else {
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <span className={classes.mentionText}>
          {data.title || shortUrl(url)}
        </span>
        {statusBadge}
      </>
    );
  }

  const anchor = (
    <a
      href={safeUrl || undefined}
      target="_blank"
      rel="noopener"
      title={url}
      className={classes.mention}
      onClick={selectForEditing}
    >
      {content}
    </a>
  );

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }}>
      {needsConnection ? (
        <HoverCard
          position="bottom-start"
          shadow="md"
          radius="md"
          openDelay={150}
          closeDelay={150}
        >
          <HoverCard.Target>{anchor}</HoverCard.Target>
          <HoverCard.Dropdown p="sm">
            <Stack gap="xs">
              <Group gap={6} wrap="nowrap">
                {getIntegrationIcon(provider, 16)}
                <Text size="sm" fw={500}>
                  {needsConnection.integrationName}
                </Text>
              </Group>
              <Button
                size="xs"
                variant="filled"
                color="dark"
                leftSection={getIntegrationIcon(provider, 16)}
                loading={connecting}
                onClick={handleConnect}
              >
                {t("Connect to {{name}} to preview", {
                  name: needsConnection.integrationName,
                })}
              </Button>
            </Stack>
          </HoverCard.Dropdown>
        </HoverCard>
      ) : (
        anchor
      )}
    </NodeViewWrapper>
  );
}

export default memo(IntegrationMentionView);
