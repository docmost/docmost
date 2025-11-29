import { Group, Text, Select } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { updateUser } from "../services/user-service";
import { useAtom } from "jotai";
import { userAtom } from "../atoms/current-user-atom";
import { useState } from "react";

export default function AccountLanguage() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Language")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred interface language.")}
        </Text>
      </div>
      <LanguageSwitcher />
    </Group>
  );
}

function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const [language, setLanguage] = useState(
    user?.locale === "en" ? "en-US" : user?.locale,
  );

  const handleChange = async (value: string) => {
    const updatedUser = await updateUser({ locale: value });

    setLanguage(value);
    setUser(updatedUser);

    i18n.changeLanguage(value);
  };

  return (
    <Select
      label={t("Select language")}
      data={[
        { value: "en-US", label: "English (US)" },
        { value: "es-ES", label: "Español (Spanish)" },
        { value: "de-DE", label: "Deutsch (German)" },
        { value: "fr-FR", label: "Français (French)" },
        { value: "nl-NL", label: "Dutch (Netherlands)" },
        { value: "pt-BR", label: "Português (Brasil)" },
        { value: "it-IT", label: "Italiano (Italian)" },
        { value: "ja-JP", label: "日本語 (Japanese)" },
        { value: "ko-KR", label: "한국어 (Korean)" },
        { value: "uk-UA", label: "Українська (Ukrainian)" },
        { value: "ru-RU", label: "Русский (Russian)" },
        { value: "zh-CN", label: "中文 (简体)" },
      ]}
      value={language || "en-US"}
      onChange={handleChange}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
