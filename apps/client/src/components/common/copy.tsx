import { ActionIcon, CopyButton, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import React from "react";
import { useTranslation } from "react-i18next";

interface CopyProps {
  text: string;
}
export default function CopyTextButton({ text }: CopyProps) {
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
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
