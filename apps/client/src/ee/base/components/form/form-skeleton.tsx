import { Skeleton, Stack } from "@mantine/core";

export function FormSkeleton() {
  return (
    <Stack gap="md" aria-hidden>
      <Skeleton height={40} width="60%" radius="sm" />
      <Skeleton height={14} width="90%" radius="sm" mt={8} />
      <Skeleton height={14} width="70%" radius="sm" />
      <Skeleton height={22} width="45%" radius="sm" mt={32} />
      <Skeleton height={42} radius="md" />
      <Skeleton height={22} width="35%" radius="sm" mt={24} />
      <Skeleton height={42} radius="md" />
    </Stack>
  );
}
