import { Text, MantineSize, SegmentedControl } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import {
  ResponsiveSettingsRow,
  ResponsiveSettingsContent,
  ResponsiveSettingsControl,
} from "@/components/ui/responsive-settings-row";
import { pageEditorAtom, hasUnsavedChangesAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useUpdatePageMutation } from "@/features/page/queries/page-query.ts";
import { notifications } from "@mantine/notifications";

export default function PageStatePref() {
  const { t } = useTranslation();

  return (
    <ResponsiveSettingsRow>
      <ResponsiveSettingsContent>
        <Text size="md">{t("Default page edit mode")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred page edit mode. Avoid accidental edits.")}
        </Text>
      </ResponsiveSettingsContent>

      <ResponsiveSettingsControl>
        <PageStateSegmentedControl />
      </ResponsiveSettingsControl>
    </ResponsiveSettingsRow>
  );
}

interface PageStateSegmentedControlProps {
  size?: MantineSize;
  pageId?: string;
  disabled?: boolean;
}

export function PageStateSegmentedControl({
  size,
  pageId,
  disabled,
}: PageStateSegmentedControlProps) {

  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [pageEditor] = useAtom(pageEditorAtom);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useAtom(hasUnsavedChangesAtom);
  const updatePageMutation = useUpdatePageMutation();
  const pageEditMode =
    user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  const [value, setValue] = useState(pageEditMode);

  const handleChange = useCallback(
    async (newValue: string) => {
      // Safety Check: Only save if the editor's internal pageId matches the expected pageId
      const editorPageId = pageEditor?.storage?.pageId;
      if (newValue === PageEditMode.Read && hasUnsavedChanges && pageEditor && pageId) {
        if (editorPageId !== pageId) {
          console.warn("Editor pageId mismatch, skipping auto-save to prevent data leak.");
          const updatedUser = await updateUser({ pageEditMode: newValue });
          setValue(newValue);
          setUser(updatedUser);
          setHasUnsavedChanges(false);
          return;
        }

        try {
          const content = pageEditor.getJSON();
          await updatePageMutation.mutateAsync({
            pageId,
            content,
            forceHistorySave: true,
          });
          setHasUnsavedChanges(false);
          notifications.show({
            message: t("Page saved successfully"),
            color: "green",
          });
        } catch (error) {
          notifications.show({
            message: t("Failed to save page"),
            color: "red",
          });
          return; // Don't switch mode if save failed
        }
      }

      const updatedUser = await updateUser({ pageEditMode: newValue });
      setValue(newValue);
      setUser(updatedUser);
    },
    [user, setUser, hasUnsavedChanges, pageEditor, pageId, updatePageMutation, setHasUnsavedChanges, t]
  );

  useEffect(() => {
    if (pageEditMode !== value) {
      setValue(pageEditMode);
    }
  }, [pageEditMode, value]);

  console.log(hasUnsavedChanges);
  return (
    <SegmentedControl
      size={size}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      data={[

        { label: t("Edit"), value: PageEditMode.Edit },
        {
          label: hasUnsavedChanges ? t("Save") : t("Read"),
          value: PageEditMode.Read
        },
      ]}
    />
  );
}
