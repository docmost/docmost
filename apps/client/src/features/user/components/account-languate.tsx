import { Group, Text, Select } from "@mantine/core";
import { useTranslation } from "react-i18next";

export default function AccountLanguage() {
  const { t } = useTranslation("user");

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
  const { t } = useTranslation("user");

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <Select
      label={t("Select language")}
      data={[
        { value: "zh", label: "中文" },
        { value: "en", label: "English" },
      ]}
      value={i18n.language}
      onChange={handleChange}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
