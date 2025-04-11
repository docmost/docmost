import { Button, Group, Text } from "@mantine/core";
import * as React from "react";
import { useState } from "react";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useAtom } from "jotai";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import {
  registerChallenge,
  removePasskey,
  verifyChallenge,
} from "@/features/auth/services/auth-service";
import { startRegistration } from "@simplewebauthn/browser";

export default function AddOrRemovePasskey() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);

  const [isLoading, setIsLoading] = useState(false);

  async function handlePasskeyChange() {
    if (currentUser?.user.hasPasskey) {
      await handlePasskeyRemove();
    } else {
      await handlePasskeyAdd();
    }
  }

  async function handlePasskeyAdd() {
    setIsLoading(true);
    try {
      const optionsJSON = await registerChallenge();
      const authenticationResponse = await startRegistration({
        optionsJSON: optionsJSON,
      });
      await verifyChallenge(authenticationResponse);
      currentUser.user.hasPasskey = true;
      setCurrentUser({ ...currentUser });
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response.data.message}`,
        color: "red",
      });
    }
    setIsLoading(false);
  }

  async function handlePasskeyRemove() {
    setIsLoading(true);
    try {
      await removePasskey();
      currentUser.user.hasPasskey = false;
      setCurrentUser({ ...currentUser });
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response.data.message}`,
        color: "red",
      });
    }
    setIsLoading(false);
  }

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Passkey")}</Text>
        <Text size="sm" c="dimmed">
          {currentUser?.user.hasPasskey
            ? t("Remove passkey.")
            : t("Register a passkey.")}
        </Text>
      </div>

      <Button
        variant="default"
        onClick={handlePasskeyChange}
        disabled={isLoading}
        loading={isLoading}
      >
        {currentUser?.user.hasPasskey ? t("Remove passkey") : t("Add passkey")}
      </Button>
    </Group>
  );
}
