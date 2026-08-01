import { Button, Center, Stack, Text, Title } from "@mantine/core";
import { IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface LockedPageScreenProps {
  pageTitle?: string;
  onUnlockClick: () => void;
}

export function LockedPageScreen({
  pageTitle,
  onUnlockClick,
}: LockedPageScreenProps) {
  const { t } = useTranslation();

  return (
    <Center
      mih="60vh"
      component="section"
      aria-labelledby="locked-page-heading"
    >
      <Stack align="center" gap="sm">
        <IconLock size={48} stroke={1.5} aria-hidden />
        {/* always a heading, so this screen is reachable by heading navigation
            even before the page title has loaded */}
        <Title order={3} id="locked-page-heading">
          {pageTitle || t("Locked page")}
        </Title>
        <Text c="dimmed" size="sm">
          {t("This page is encrypted. Enter its password to view it.")}
        </Text>
        <Button onClick={onUnlockClick} mt="sm">
          {t("Unlock")}
        </Button>
      </Stack>
    </Center>
  );
}
