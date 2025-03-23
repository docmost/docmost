import { useTranslation } from "react-i18next";
import { useRemoveLicenseMutation } from "@/ee/licence/queries/license-query.ts";
import { Button, Group, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import React from "react";

export default function RemoveLicense() {
  const { t } = useTranslation();
  const removeLicenseMutation = useRemoveLicenseMutation();

  const openDeleteModal = () =>
    modals.openConfirmModal({
      title: t("Remove license key"),
      centered: true,
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to remove your license key? Your workspace will be downgraded to the non-enterprise version.",
          )}
        </Text>
      ),
      labels: { confirm: t("Remove"), cancel: t("Don't") },
      confirmProps: { color: "red" },
      onConfirm: () => removeLicenseMutation.mutate(),
    });

  return (
    <Group>
      <Button variant="light" color="red" onClick={openDeleteModal}>Remove license</Button>
    </Group>
  );
}

