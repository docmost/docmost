import { ActionIcon, MantineColor, MantineSize, Tooltip } from "@mantine/core";
import { CopyButton } from "@/components/common/copy-button";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import React from "react";
import { useTranslation } from "react-i18next";

interface CopyProps {
  text: string;
  size?: MantineSize;
  color?: MantineColor;
  /** Override the accessible name (and tooltip) when not yet copied. Lets callers disambiguate adjacent copy buttons for screen readers. */
  label?: string;
}
export default function CopyTextButton({ text, size, label }: CopyProps) {
  const { t } = useTranslation();

  const copyLabel = label ?? t("Copy");

  return (
    <CopyButton value={text} timeout={2000}>
      {({ copied, copy }) => (
        <Tooltip
          label={copied ? t("Copied") : copyLabel}
          withArrow
          position="right"
        >
          <ActionIcon
            color={copied ? "teal" : "gray"}
            variant="subtle"
            onClick={copy}
            size={size}
            aria-label={copied ? t("Copied") : copyLabel}
          >
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
          </ActionIcon>
        </Tooltip>
      )}
    </CopyButton>
  );
}
