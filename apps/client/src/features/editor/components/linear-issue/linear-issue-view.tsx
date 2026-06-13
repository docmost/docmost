import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  Anchor,
  Avatar,
  Badge,
  Divider,
  Group,
  HoverCard,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { markdownToHtml, sanitizeUrl } from "@docmost/editor-ext";
import DOMPurify from "dompurify";
import { useLinearIssueQuery } from "@/features/linear/queries/linear-query";
import LinearIcon from "@/components/icons/linear-icon.tsx";
import LinearConnectPrompt from "./linear-connect-prompt";
import classes from "./linear-issue.module.css";

export default function LinearIssueView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { issueId, identifier, url, title } = props.node.attrs;
  const [opened, setOpened] = useState(false);
  const { data, isLoading } = useLinearIssueQuery(issueId, opened);
  const issue = data?.issue;

  const label = identifier ?? title ?? t("Linear issue");

  const descriptionHtml = useMemo(
    () =>
      issue?.description
        ? DOMPurify.sanitize(markdownToHtml(issue.description) as string)
        : "",
    [issue?.description],
  );

  const renderPreview = () => {
    if (isLoading) {
      return (
        <Group justify="center" py="xs">
          <Loader size="sm" />
        </Group>
      );
    }

    if (data && !data.connected) {
      return <LinearConnectPrompt action="preview" />;
    }

    if (!issue) {
      return (
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      );
    }

    return (
      <Stack gap={8}>
        <Group justify="space-between" wrap="nowrap" align="flex-start" gap="md">
          <Text size="sm" fw={600} lh={1.3} style={{ flex: 1, minWidth: 0 }}>
            {issue.title}
          </Text>
          <Stack gap={4} align="flex-end" style={{ flexShrink: 0 }}>
            {issue.state && (
              <Group gap={5} wrap="nowrap" align="center">
                <span
                  className={classes.stateDot}
                  style={{ backgroundColor: issue.state.color }}
                />
                <Text size="xs" fw={500}>
                  {issue.state.name}
                </Text>
              </Group>
            )}
            {issue.assignee && (
              <Group gap={6} wrap="nowrap" align="center">
                {issue.assignee.avatarUrl && (
                  <Avatar src={issue.assignee.avatarUrl} size={18} radius="xl" />
                )}
                <Text size="xs" c="dimmed">
                  {issue.assignee.displayName ?? issue.assignee.name}
                </Text>
              </Group>
            )}
            {issue.priorityLabel && issue.priority > 0 && (
              <Badge size="xs" variant="light" color="gray" radius="sm">
                {issue.priorityLabel}
              </Badge>
            )}
          </Stack>
        </Group>

        {issue.description && (
          <>
            <Divider />
            <Text
              component="div"
              size="xs"
              c="dimmed"
              className={classes.description}
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          </>
        )}

        <Anchor
          href={sanitizeUrl(issue.url ?? url) || undefined}
          target="_blank"
          rel="noopener noreferrer"
          size="xs"
        >
          <Group gap={4} wrap="nowrap">
            <IconExternalLink size={14} />
            {t("Open in Linear")}
          </Group>
        </Anchor>
      </Stack>
    );
  };

  return (
    <NodeViewWrapper as="span" className={classes.wrapper}>
      <HoverCard
        openDelay={250}
        closeDelay={100}
        width={320}
        shadow="md"
        position="top-start"
        withinPortal
        onOpen={() => setOpened(true)}
      >
        <HoverCard.Target>
          <a
            className={classes.chip}
            href={sanitizeUrl(url) || undefined}
            target="_blank"
            rel="noopener noreferrer"
            contentEditable={false}
          >
            <LinearIcon size={14} />
            <span>{label}</span>
          </a>
        </HoverCard.Target>
        <HoverCard.Dropdown className={classes.dropdown}>
          {renderPreview()}
        </HoverCard.Dropdown>
      </HoverCard>
    </NodeViewWrapper>
  );
}
