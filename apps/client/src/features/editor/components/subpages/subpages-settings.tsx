import { Button, Group, Modal, Stack, Switch, TextInput } from "@mantine/core";
import type { SubpagesAttributes } from "@docmost/editor-ext";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type HeadingSettings = Pick<SubpagesAttributes, "heading" | "hideHeading">;

interface SubpagesSettingsProps {
  heading: string;
  hideHeading: boolean;
  defaultHeading: string;
  onClose: () => void;
  onSave: (changes: HeadingSettings) => void;
}

export function SubpagesSettings({
  heading,
  hideHeading,
  defaultHeading,
  onClose,
  onSave,
}: SubpagesSettingsProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<HeadingSettings>({});
  const name = draft.heading ?? heading;
  const hidden = draft.hideHeading ?? hideHeading;

  return (
    <Modal
      opened
      onClose={onClose}
      title={t("Subpages settings")}
      closeButtonProps={{ "aria-label": t("Close") }}
      size="sm"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const changes: HeadingSettings = {};
          if (name.trim() !== heading) changes.heading = name.trim();
          if (hidden !== hideHeading) changes.hideHeading = hidden;
          onSave(changes);
        }}
      >
        <Stack>
          <TextInput
            label={t("Heading text")}
            placeholder={defaultHeading}
            value={name}
            onChange={(event) =>
              setDraft({ ...draft, heading: event.currentTarget.value })
            }
            data-autofocus
          />
          <Switch
            label={t("Show block heading")}
            checked={!hidden}
            onChange={(event) =>
              setDraft({ ...draft, hideHeading: !event.currentTarget.checked })
            }
          />
          <Group justify="flex-end" gap="xs" mt="xs">
            <Button type="button" variant="default" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit">{t("Save")}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
