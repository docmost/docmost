import {
  Group,
  Text,
  useMantineColorScheme,
  Select,
  MantineColorScheme,
} from "@mantine/core";
import { useTranslation } from "react-i18next";

export default function AccountTheme() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Theme")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred color scheme.")}
        </Text>
      </div>

      <ThemeSwitcher />
    </Group>
  );
}

function ThemeSwitcher() {
  const { t } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const handleChange = (value: MantineColorScheme) => {
    setColorScheme(value);
  };

  return (
    <Select
      label={t("Select theme")}
      data={[
        { value: "light", label: t("Light") },
        { value: "dark", label: t("Dark") },
        { value: "auto", label: t("System settings") },
      ]}
      value={colorScheme}
      onChange={handleChange}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
