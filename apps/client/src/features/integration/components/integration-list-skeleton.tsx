import { Box, Group, Skeleton, Stack } from "@mantine/core";

const TITLE_WIDTHS = [64, 52, 60, 44, 58, 96, 56];
const DESCRIPTION_WIDTHS = [300, 250, 320, 180, 290, 270, 260];

type IntegrationListSkeletonProps = {
  rows?: number;
  withBadges?: boolean;
};

export default function IntegrationListSkeleton({
  rows = 7,
  withBadges = true,
}: IntegrationListSkeletonProps) {
  return (
    <Stack gap={0} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Box
          key={index}
          py="sm"
          px="xs"
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)",
          }}
        >
          <Group justify="space-between" wrap="nowrap">
            <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
              <Skeleton height={28} circle style={{ flexShrink: 0 }} />
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Group gap="xs" wrap="nowrap" h={20}>
                  <Skeleton
                    height={12}
                    width={TITLE_WIDTHS[index % TITLE_WIDTHS.length]}
                    radius="xs"
                  />
                  {withBadges && (
                    <>
                      <Skeleton height={16} width={52} radius="xl" />
                      <Skeleton height={16} width={52} radius="xl" />
                    </>
                  )}
                </Group>
                <Group h={17}>
                  <Skeleton
                    height={10}
                    width={
                      DESCRIPTION_WIDTHS[index % DESCRIPTION_WIDTHS.length]
                    }
                    maw="100%"
                    radius="xs"
                  />
                </Group>
              </Stack>
            </Group>
            <Skeleton
              height={30}
              width={64}
              radius="sm"
              style={{ flexShrink: 0 }}
            />
          </Group>
        </Box>
      ))}
    </Stack>
  );
}
