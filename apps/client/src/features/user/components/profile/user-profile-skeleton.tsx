import { Grid, Group, Paper, Skeleton, Stack } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { LabelPageRowSkeleton } from "@/features/label/components/label-page-row-skeleton";
import { UserProfileCard } from "@/features/user/components/profile/user-profile-card";
import classes from "@/features/user/components/profile/user-profile.module.css";

export function UserProfileSkeleton() {
  const { t } = useTranslation();

  return (
    <Stack
      gap="lg"
      role="status"
      aria-busy="true"
      aria-label={t("Loading profile")}
    >
      <Paper withBorder radius="md" p="lg">
        <div className={classes.header} aria-hidden="true">
          <Skeleton circle height={72} flex="none" />
          <div className={classes.headerBody}>
            <Group gap="xs">
              <Skeleton height={26} width={200} radius="sm" my={4} />
              <Skeleton height={20} width={64} radius="xl" />
            </Group>
            <div className={classes.meta}>
              <Skeleton height={14} width={170} radius="xs" my={4} />
            </div>
          </div>
          <Skeleton height={36} width={112} radius="sm" />
        </div>
      </Paper>

      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <UserProfileCard title={t("Recent pages")}>
            <UserProfileRecentPagesSkeleton />
          </UserProfileCard>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <UserProfileCard title={t("Spaces")}>
            <UserProfileSpacesSkeleton />
          </UserProfileCard>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export function UserProfileRecentPagesSkeleton() {
  return (
    <div>
      <LabelPageRowSkeleton titleWidth={200} metaWidth={150} />
      <LabelPageRowSkeleton titleWidth={150} metaWidth={120} />
      <LabelPageRowSkeleton titleWidth={180} metaWidth={160} />
      <LabelPageRowSkeleton titleWidth={120} metaWidth={130} />
    </div>
  );
}

export function UserProfileSpacesSkeleton() {
  return (
    <div className={classes.spaceList}>
      <UserProfileSpaceRowSkeleton nameWidth={110} />
      <UserProfileSpaceRowSkeleton nameWidth={80} />
      <UserProfileSpaceRowSkeleton nameWidth={100} />
      <UserProfileSpaceRowSkeleton nameWidth={90} />
    </div>
  );
}

function UserProfileSpaceRowSkeleton({ nameWidth }: { nameWidth: number }) {
  return (
    <div className={classes.spaceRow} aria-hidden="true">
      <Skeleton circle height={24} flex="none" />
      <Skeleton height={14} width={nameWidth} radius="xs" />
    </div>
  );
}
