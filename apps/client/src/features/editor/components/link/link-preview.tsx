import {
  Tooltip,
  ActionIcon,
  Card,
  Divider,
  Anchor,
  Flex,
} from "@mantine/core";
import { IconLinkOff, IconPencil } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./link.module.css";

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
  const { t } = useTranslation();

  return (
    <>
      <Card withBorder radius="md" padding="xs" bg="var(--mantine-color-body)">
        <Flex align="center">
          <Tooltip label={url}>
            <Anchor
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={classes.link}
            >
              {url}
            </Anchor>
          </Tooltip>

          <Flex align="center">
            <Divider mx={4} orientation="vertical" />

            <Tooltip label={t("Edit link")}>
              <ActionIcon onClick={onEdit} variant="subtle" color="gray">
                <IconPencil size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t("Remove link")}>
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
