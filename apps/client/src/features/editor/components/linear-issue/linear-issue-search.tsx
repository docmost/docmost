import { useEffect, useRef, useState } from "react";
import {
  Group,
  Loader,
  Paper,
  ScrollArea,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { useLinearIssueSearchQuery } from "@/features/linear/queries/linear-query";
import { ILinearIssue } from "@/features/linear/types/linear.types";
import LinearIcon from "@/components/icons/linear-icon.tsx";
import LinearConnectPrompt from "./linear-connect-prompt";
import classes from "./linear-issue.module.css";

interface Props {
  onSelect: (issue: ILinearIssue) => void;
  onClose: () => void;
}

export default function LinearIssueSearch({ onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced] = useDebouncedValue(query, 250);
  const { data, isFetching } = useLinearIssueSearchQuery(debounced);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const issues = data?.issues ?? [];
  const notConnected = data && data.connected === false;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedIndex(0);
  }, [debounced, data]);

  // focus after the slash menu closes (which returns focus to the editor)
  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, issues.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (issues[selectedIndex]) onSelect(issues[selectedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <Paper shadow="md" withBorder className={classes.searchPanel}>
      <TextInput
        ref={inputRef}
        variant="unstyled"
        placeholder={t("Search Linear issues...")}
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        leftSection={<LinearIcon size={16} />}
        rightSection={isFetching ? <Loader size="xs" /> : null}
        px="xs"
      />
      <ScrollArea.Autosize mah={260}>
        {notConnected ? (
          <LinearConnectPrompt action="search" p="sm" />
        ) : issues.length === 0 ? (
          <Text size="sm" c="dimmed" p="sm">
            {debounced ? t("No issues found") : t("Type to search")}
          </Text>
        ) : (
          issues.map((issue, idx) => (
            <UnstyledButton
              key={issue.id}
              className={classes.searchItem}
              data-selected={idx === selectedIndex || undefined}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => onSelect(issue)}
            >
              <Group gap="xs" wrap="nowrap">
                {issue.state && (
                  <span
                    className={classes.stateDot}
                    style={{ backgroundColor: issue.state.color }}
                  />
                )}
                <Text size="xs" c="dimmed" className={classes.itemId}>
                  {issue.identifier}
                </Text>
                <Text size="sm" truncate>
                  {issue.title}
                </Text>
              </Group>
            </UnstyledButton>
          ))
        )}
      </ScrollArea.Autosize>
    </Paper>
  );
}
