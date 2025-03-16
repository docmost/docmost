import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });

  return (
    <ActionIcon
      onClick={() => setColorScheme(computedColorScheme === 'light' ? 'dark' : 'light')}
      variant="transparent"
      size="md"
      color="foreground"
      aria-label="Toggle color scheme"
    >
      {computedColorScheme === 'light' ? (
        <IconMoon size={18} stroke={1.5} />
      ) : (
        <IconSun size={18} stroke={1.5} />
      )}
    </ActionIcon>
  );
} 