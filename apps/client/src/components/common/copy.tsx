import { ActionIcon, MantineColor, MantineSize, Tooltip } from "@mantine/core";
import { CopyButton } from "@/components/common/copy-button";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import React from "react";
import { useTranslation } from "react-i18next";

interface CopyProps {
  text: string;
  size?: MantineSize;
  color?: MantineColor;
}
export default function CopyTextButton({ text, size }: CopyProps) {
  const { t } = useTranslation();

  return (
    <CopyButton value={text} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip
          label={copied ? t("Copied") : t("Copy")}
          withArrow
          position="right"
        >
          <ActionIcon
            color={copied ? "teal" : "gray"}
            variant="subtle"
            onClick={copy}
            size={size}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
