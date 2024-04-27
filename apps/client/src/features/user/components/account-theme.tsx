import {
  Group,
  Text,
  useMantineColorScheme,
  Select,
  MantineColorScheme,
} from "@mantine/core";

export default function AccountTheme() {
  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">Theme</Text>
        <Text size="sm" c="dimmed">
          Choose your preferred color scheme.
        </Text>
      </div>

      <ThemeSwitcher />
    </Group>
  );
}

function ThemeSwitcher() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const handleChange = (value: MantineColorScheme) => {
    setColorScheme(value);
  };

  return (
    <Select
      label="Select theme"
      data={[
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
        { value: "auto", label: "System settings" },
      ]}
      value={colorScheme}
      onChange={handleChange}
      allowDeselect={false}
      checkIconPosition="right"
    />
  );
}
