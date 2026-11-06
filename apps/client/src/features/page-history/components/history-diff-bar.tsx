import type { CSSProperties } from "react";
import { ActionIcon, Group, Paper, Switch, Text } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import {
  diffCountsAtom,
  highlightChangesAtom,
} from "@/features/page-history/atoms/history-atoms";

interface HistoryDiffBarProps {
  currentChangeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  compact?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function HistoryDiffBar({
  currentChangeIndex,
  onPrev,
  onNext,
  compact,
  className,
  style,
}: HistoryDiffBarProps) {
  const { t } = useTranslation();
  const [highlightChanges, setHighlightChanges] = useAtom(highlightChangesAtom);
  const diffCounts = useAtomValue(diffCountsAtom);

  return (
    <Paper
      shadow={compact ? "sm" : "md"}
      radius="xl"
      px="md"
      py="xs"
      className={className}
      style={style}
    >
      <Group gap={compact ? "sm" : "md"} wrap="nowrap">
        <Switch
          label={t("Highlight changes")}
          checked={highlightChanges}
          onChange={(e) => setHighlightChanges(e.currentTarget.checked)}
          size={compact ? "sm" : undefined}
          styles={{ label: { userSelect: "none", whiteSpace: "nowrap" } }}
        />
        {highlightChanges && diffCounts && diffCounts.total > 0 && (
          <Group gap={compact ? 4 : "xs"} wrap="nowrap">
            <Text size="sm" c="dimmed" style={{ whiteSpace: "nowrap" }}>
              {t("{{current}} of {{total}}", {
                current: currentChangeIndex,
                total: diffCounts.total,
              })}
            </Text>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={t("Previous change")}
              onClick={onPrev}
            >
              <IconChevronUp size={16} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              aria-label={t("Next change")}
              onClick={onNext}
            >
              <IconChevronDown size={16} />
            </ActionIcon>
          </Group>
        )}
      </Group>
    </Paper>
  );
}
