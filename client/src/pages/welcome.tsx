import { Title, Text, Stack } from '@mantine/core';
import { ThemeToggle } from '@/components/theme-toggle';

export function Welcome() {
  return (
    <Stack>
      <Title ta="center" mt={100}>
        <Text
          inherit
          variant="gradient"
          component="span"
          gradient={{ from: 'pink', to: 'yellow' }}
        >
          Welcome
        </Text>
      </Title>
      <Text ta="center" size="lg" maw={580} mx="auto" mt="xl">
        Welcome to something new and interesting.
      </Text>
      <ThemeToggle />
    </Stack>
  );
}
