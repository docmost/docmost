import {
  Anchor,
  Button,
  Divider,
  Group,
  Input,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LabelFilter } from "@/features/label/components/label-filter";
import classes from "./page-list-settings.module.css";

export function getPageListSettingsChanges<T extends object>(
  initial: T,
  draft: T,
): Partial<T> {
  const changes: Partial<T> = {};
  for (const key in draft) {
    if (JSON.stringify(draft[key]) !== JSON.stringify(initial[key])) {
      changes[key] = draft[key];
    }
  }
  return changes;
}

export function PageListSettingsModal({
  title,
  description,
  primaryFilter,
  filters,
  display,
  canSave,
  onSave,
  onClose,
}: {
  title: string;
  description: string;
  primaryFilter: ReactNode;
  filters: ReactNode;
  display: ReactNode;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [optionsOpen, setOptionsOpen] = useState(false);
  return (
    <Modal
      opened
      onClose={onClose}
      title={title}
      size={576}
      padding={24}
      classNames={{ title: classes.modalTitle, header: classes.modalHeader }}
      closeButtonProps={{ "aria-label": t("Close") }}
    >
      <form
        className={classes.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave();
        }}
      >
        <Text size="sm" c="dimmed" mb="lg">
          {description}
        </Text>
        <Stack gap="md">{primaryFilter}</Stack>
        <UnstyledButton
          type="button"
          className={classes.moreOptions}
          aria-expanded={optionsOpen}
          aria-controls={id}
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <IconChevronRight size={16} aria-hidden />
          {t("More options")}
        </UnstyledButton>
        <div id={id} hidden={!optionsOpen}>
          {optionsOpen && (
            <Stack gap="md" mt="md">
              {filters}
              <Divider />
              <Stack
                component="section"
                gap="md"
                aria-labelledby={id + "-display"}
              >
                <h3 id={id + "-display"} className={classes.sectionTitle}>
                  {t("Display")}
                </h3>
                {display}
              </Stack>
            </Stack>
          )}
        </div>
        <Group justify="flex-end" gap="xs" className={classes.actions}>
          <Button type="button" variant="default" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={!canSave}>
            {t("Save")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

type Match = "any" | "all";

export function PageListFilterGroup({
  label,
  matchLabel,
  showMatch,
  match,
  onMatchChange,
  hint,
  excludeLabel,
  hasExclusions,
  renderIncluded,
  renderExcluded,
}: {
  label: string;
  matchLabel: string;
  showMatch: boolean;
  match: Match;
  onMatchChange: (value: Match) => void;
  hint: string;
  excludeLabel: string;
  hasExclusions: boolean;
  renderIncluded: (props: {
    id: string;
    "aria-label": string;
    description: ReactNode;
  }) => ReactNode;
  renderExcluded: (props: { label: string; autoFocus: boolean }) => ReactNode;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [showExclusions, setShowExclusions] = useState(hasExclusions);
  return (
    <>
      <Stack gap={6}>
        <Group justify="space-between" gap="xs">
          <Input.Label htmlFor={id}>{label}</Input.Label>
          {showMatch && (
            <Group gap={8} wrap="nowrap">
              <Text component="span" size="sm" c="dimmed">
                {t("Match")}
              </Text>
              <SegmentedControl<Match>
                aria-label={matchLabel}
                size="xs"
                radius="md"
                value={match}
                onChange={onMatchChange}
                data={[
                  { value: "any", label: t("Any") },
                  { value: "all", label: t("All") },
                ]}
              />
            </Group>
          )}
        </Group>
        {renderIncluded({
          id,
          "aria-label": label,
          description: (
            <Group component="span" justify="space-between" gap="xs" mt={6}>
              <Text component="span" aria-live="polite" size="sm" c="dimmed">
                {hint}
              </Text>
              {!showExclusions && (
                <Anchor
                  component="button"
                  type="button"
                  size="sm"
                  className={classes.addExclusion}
                  onClick={() => setShowExclusions(true)}
                >
                  <IconPlus size={14} aria-hidden />
                  {excludeLabel}
                </Anchor>
              )}
            </Group>
          ),
        })}
      </Stack>
      {showExclusions &&
        renderExcluded({ label: excludeLabel, autoFocus: !hasExclusions })}
    </>
  );
}

export function PageListLabelFilters({
  labels,
  excludeLabels,
  match,
  required,
  maxValues,
  isWithinLength,
  onLabelsChange,
  onExcludeLabelsChange,
  onMatchChange,
}: {
  labels: string[];
  excludeLabels: string[];
  match: Match;
  required?: boolean;
  maxValues: number;
  isWithinLength: (name: string) => boolean;
  onLabelsChange: (values: string[]) => void;
  onExcludeLabelsChange: (values: string[]) => void;
  onMatchChange: (value: Match) => void;
}) {
  const { t } = useTranslation();
  const inputProps = {
    maxValues,
    isWithinLength,
    className: classes.labelFilter,
    placeholder: t("Add label…"),
  };
  return (
    <PageListFilterGroup
      label={t("Labels")}
      matchLabel={t("Label matching")}
      showMatch={labels.length > 1}
      match={match}
      onMatchChange={onMatchChange}
      hint={
        !required && !labels.length
          ? t("Add labels to narrow the list.")
          : match === "all"
            ? t("Pages need all of these labels.")
            : t("Pages need at least one of these labels.")
      }
      excludeLabel={t("Exclude labels")}
      hasExclusions={excludeLabels.length > 0}
      renderIncluded={(field) => (
        <LabelFilter
          {...inputProps}
          {...field}
          required={required}
          value={labels}
          onChange={onLabelsChange}
        />
      )}
      renderExcluded={(field) => (
        <LabelFilter
          {...inputProps}
          {...field}
          value={excludeLabels}
          onChange={onExcludeLabelsChange}
        />
      )}
    />
  );
}

export function PageListLimitInput({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number | string;
  onChange: (value: number | string) => void;
}) {
  const { t } = useTranslation();
  return (
    <NumberInput<number>
      label={t("Show up to")}
      min={1}
      max={max}
      allowDecimal={false}
      value={value}
      onChange={onChange}
      description={t("pages")}
      inputWrapperOrder={["label", "input", "description", "error"]}
      classNames={{ root: classes.limitField, description: classes.limitUnit }}
    />
  );
}
