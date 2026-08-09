import { NodeViewWrapper } from "@tiptap/react";
import { Avatar, Badge, Text } from "@mantine/core";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { getIntegrationIcon } from "@/features/integration/components/integration-icons";
import { useUnfurl } from "./use-unfurl";
import { badgeTextColor, toBadgeColor } from "./badge-color";
import classes from "./integration-link-view.module.css";

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function IntegrationMentionView(props: any) {
  const { node, updateAttributes } = props;
  const { url, provider, unfurlData, status } = node.attrs;
  const { t } = useTranslation();

  useUnfurl(url, status, updateAttributes);

  const data = unfurlData;
  const meta = data?.metadata ?? {};
  const isSlackMessage =
    provider === "slack" && (meta.type === "message" || (!meta.type && meta.ts));
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
    // pending / error / needs-connection: a compact link chip
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <span className={classes.mentionText}>{shortUrl(url)}</span>
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
          <Text component="span" size="sm" c="dimmed">
            {data.author}
          </Text>
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
    // Jira: type icon leads, provider icon trails.
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
        <Text component="span" size="sm" c="dimmed">
          {meta.issueKey}
        </Text>
        <span className={classes.mentionText}>{data.title}</span>
        {statusBadge}
        {meta.issueTypeIconUrl && getIntegrationIcon(provider, 14)}
      </>
    );
  } else if (issueNumber) {
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <Text component="span" size="sm" c="dimmed">
          #{issueNumber}
        </Text>
        <span className={classes.mentionText}>{data.title}</span>
        {statusBadge}
      </>
    );
  } else if (typeLabel) {
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <Text component="span" size="sm" c="dimmed">
          {typeLabel}
        </Text>
        <span className={classes.mentionText}>{data.title}</span>
        {statusBadge}
      </>
    );
  } else {
    content = (
      <>
        {getIntegrationIcon(provider, 14)}
        <span className={classes.mentionText}>{data.title || shortUrl(url)}</span>
        {statusBadge}
      </>
    );
  }

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }}>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        title={url}
        className={classes.mention}
      >
        {content}
      </a>
    </NodeViewWrapper>
  );
}

export default memo(IntegrationMentionView);
