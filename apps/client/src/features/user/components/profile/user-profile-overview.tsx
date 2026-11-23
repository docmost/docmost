import { Grid } from "@mantine/core";
import { UserProfileRecentPages } from "@/features/user/components/profile/user-profile-recent-pages";
import { UserProfileSpaces } from "@/features/user/components/profile/user-profile-spaces";

type UserProfileOverviewProps = {
  userId: string;
  isSelf: boolean;
};

export function UserProfileOverview({
  userId,
  isSelf,
}: UserProfileOverviewProps) {
  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: 7 }}>
        <UserProfileRecentPages userId={userId} isSelf={isSelf} />
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 5 }}>
        <UserProfileSpaces userId={userId} isSelf={isSelf} />
      </Grid.Col>
    </Grid>
  );
}
