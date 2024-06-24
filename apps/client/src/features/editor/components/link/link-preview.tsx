import {
  Tooltip,
  ActionIcon,
  Card,
  Divider,
  Anchor,
  Flex,
} from "@mantine/core";
import { IconLinkOff, IconPencil } from "@tabler/icons-react";

export type LinkPreviewPanelProps = {
  url: string;
  onEdit: () => void;
  onClear: () => void;
};

export const LinkPreviewPanel = ({
  onClear,
  onEdit,
  url,
}: LinkPreviewPanelProps) => {
  return (
    <>
      <Card withBorder radius="md" padding="xs" bg="var(--mantine-color-body)">
        <Flex align="center">
          <Tooltip label={url}>
            <Anchor
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              inherit
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {url}
            </Anchor>
          </Tooltip>

          <Flex align="center">
            <Divider mx={4} orientation="vertical" />

            <Tooltip label="Edit link">
              <ActionIcon onClick={onEdit} variant="subtle" color="gray">
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label="Remove link">
              <ActionIcon onClick={onClear} variant="subtle" color="red">
                <IconLinkOff size={16} />
              </ActionIcon>
            </Tooltip>
          </Flex>
        </Flex>
      </Card>
    </>
  );
};
