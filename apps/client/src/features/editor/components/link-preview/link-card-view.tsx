import { isHttpUrl } from "@docmost/editor-ext";
import { Card, Group, Skeleton, Stack, Text } from "@mantine/core";
import { IconWorld } from "@tabler/icons-react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatLinkLocation, selectForEditing } from "./link-preview.utils";
import { useLinkPreviewFill } from "./use-link-preview-fill";
import classes from "./link-card-view.module.css";

function LinkCardView(props: NodeViewProps) {
  const { editor, getPos, node } = props;
  const { url, title, description, image, icon } = node.attrs;
  const safeUrl = isHttpUrl(url) ? url : "";
  const location = formatLinkLocation(url);
  const { t } = useTranslation();
  const { isLoading } = useLinkPreviewFill(props);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [failedIcon, setFailedIcon] = useState<string | null>(null);
  const showImage = isHttpUrl(image) && image !== failedImage;
  const showIcon = isHttpUrl(icon) && icon !== failedIcon;

  const handleSelect = (event: React.MouseEvent<HTMLElement>) =>
    selectForEditing(event, editor, getPos);

  if (isLoading) {
    return (
      <NodeViewWrapper data-drag-handle="" onClickCapture={handleSelect}>
        <Card
          className={classes.card}
          withBorder
          padding="sm"
          radius="sm"
          orientation="horizontal"
          role="status"
          aria-busy="true"
          aria-label={t("Loading preview")}
        >
          <Stack gap={10} justify="center" className={classes.body}>
            <Skeleton height={14} width="55%" />
            <Skeleton height={10} width="90%" />
            <Skeleton height={10} width="70%" />
            <Group gap={6} wrap="nowrap">
              <Skeleton height={14} width={14} radius="sm" />
              <Skeleton height={10} width="30%" />
            </Group>
          </Stack>
          <Card.Section withBorder className={classes.imageBox}>
            <Skeleton height="100%" radius={0} />
          </Card.Section>
        </Card>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle="" onClickCapture={handleSelect}>
      <Card
        className={classes.card}
        withBorder
        padding="sm"
        radius="sm"
        orientation="horizontal"
        component="a"
        href={safeUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
      >
        {title ? (
          <Stack gap={4} justify="center" className={classes.body}>
            <Text size="sm" fw={600} truncate>
              {title}
            </Text>
            {description && (
              <Text size="xs" c="dimmed" lineClamp={2}>
                {description}
              </Text>
            )}
            <Group gap={6} wrap="nowrap">
              {showIcon ? (
                <img
                  src={icon}
                  alt=""
                  width={14}
                  height={14}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className={classes.icon}
                  onError={() => setFailedIcon(icon)}
                />
              ) : (
                <IconWorld
                  size={14}
                  stroke={1.5}
                  className={classes.icon}
                  color="var(--mantine-color-dimmed)"
                />
              )}
              <Text size="xs" c="dimmed" truncate>
                {location}
              </Text>
            </Group>
          </Stack>
        ) : (
          <Group gap={8} wrap="nowrap" className={classes.body}>
            <IconWorld size={16} stroke={1.5} className={classes.icon} />
            <Text size="sm" fw={600} truncate>
              {location}
            </Text>
          </Group>
        )}

        {title && showImage && (
          <Card.Section withBorder className={classes.imageBox}>
            <img
              src={image}
              alt=""
              decoding="async"
              referrerPolicy="no-referrer"
              className={classes.image}
              onError={() => setFailedImage(image)}
            />
          </Card.Section>
        )}
      </Card>
    </NodeViewWrapper>
  );
}

export default memo(LinkCardView);
