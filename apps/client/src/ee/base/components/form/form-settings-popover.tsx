import { useEffect, useRef, useState } from "react";
import {
  ActionIcon,
  Divider,
  Popover,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useDebouncedCallback } from "@mantine/hooks";
import { IconSettings } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { FormConfig, IBaseView } from "@/ee/base/types/base.types";
import { useUpdateFormConfig } from "@/ee/base/queries/base-form-query";

type TextSettingKey = "submitLabel" | "successTitle" | "successMessage";

type FormSettingsPopoverProps = {
  pageId: string;
  view: IBaseView;
};

export function FormSettingsPopover({ pageId, view }: FormSettingsPopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const updateForm = useUpdateFormConfig(pageId, view.id);
  const form: FormConfig = view.config?.form ?? {};

  const commitText = (key: TextSettingKey, value: string) => {
    const next = value.trim();
    updateForm((current) =>
      (current[key] ?? "") === next
        ? current
        : { ...current, [key]: next || undefined },
    );
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={320}
      position="bottom-end"
      shadow="md"
      withinPortal
      trapFocus
    >
      <Popover.Target>
        <Tooltip label={t("Form settings")}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            aria-label={t("Form settings")}
            onClick={() => setOpened((o) => !o)}
          >
            <IconSettings size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <Text size="sm" fw={600}>
            {t("Form settings")}
          </Text>
          <SettingTextField
            label={t("Submit button label")}
            placeholder={t("Submit")}
            value={form.submitLabel ?? ""}
            maxLength={60}
            onCommit={(value) => commitText("submitLabel", value)}
          />
          <Divider
            label={t("After submitting")}
            labelPosition="left"
            my={4}
          />
          <SettingTextField
            label={t("Confirmation title")}
            placeholder={t("Thank you!")}
            value={form.successTitle ?? ""}
            maxLength={200}
            onCommit={(value) => commitText("successTitle", value)}
          />
          <SettingTextField
            label={t("Confirmation message")}
            placeholder={t("Your response has been recorded.")}
            value={form.successMessage ?? ""}
            maxLength={2000}
            multiline
            onCommit={(value) => commitText("successMessage", value)}
          />
          <Switch
            size="sm"
            label={t("Allow submitting another response")}
            checked={form.allowResubmit !== false}
            onChange={(event) => {
              const allowResubmit = event.currentTarget.checked;
              updateForm((current) => ({
                ...current,
                allowResubmit: allowResubmit ? undefined : false,
              }));
            }}
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

type SettingTextFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  maxLength: number;
  multiline?: boolean;
  onCommit: (value: string) => void;
};

function SettingTextField({
  label,
  placeholder,
  value,
  maxLength,
  multiline,
  onCommit,
}: SettingTextFieldProps) {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const commit = useDebouncedCallback(onCommit, {
    delay: 500,
    flushOnUnmount: true,
  });

  useEffect(() => {
    if (!focusedRef.current) setDraft(value);
  }, [value]);

  const inputProps = {
    label,
    placeholder,
    maxLength,
    size: "xs" as const,
    value: draft,
    onFocus: () => {
      focusedRef.current = true;
    },
    onBlur: () => {
      focusedRef.current = false;
      commit.flush();
    },
  };

  if (multiline) {
    return (
      <Textarea
        {...inputProps}
        autosize
        minRows={2}
        maxRows={6}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          commit(event.currentTarget.value);
        }}
      />
    );
  }

  return (
    <TextInput
      {...inputProps}
      onChange={(event) => {
        setDraft(event.currentTarget.value);
        commit(event.currentTarget.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
