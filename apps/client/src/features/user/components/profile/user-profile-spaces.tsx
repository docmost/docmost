import { Button } from "@mantine/core";
import { IconAlertTriangle, IconLayoutGrid } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { prefetchSpace } from "@/features/space/queries/space-query";
import { UserProfileCard } from "@/features/user/components/profile/user-profile-card";
import { UserProfileSpacesSkeleton } from "@/features/user/components/profile/user-profile-skeleton";
import { useUserSpacesQuery } from "@/features/user/queries/user-query";
import { IUserProfileSpace } from "@/features/user/types/user.types";
import { getSpaceUrl } from "@/lib/config";
import classes from "@/features/user/components/profile/user-profile.module.css";

type UserProfileSpacesProps = {
  userId: string;
  isSelf: boolean;
};

export function UserProfileSpaces({ userId, isSelf }: UserProfileSpacesProps) {
  const { t } = useTranslation();
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserSpacesQuery(userId);
  const spaces = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <UserProfileCard title={t("Spaces")}>
      {isPending ? (
        <div role="status" aria-busy="true" aria-label={t("Loading profile")}>
          <UserProfileSpacesSkeleton />
        </div>
      ) : spaces.length > 0 ? (
        <>
          <div className={classes.spaceList}>
            {spaces.map((space) => (
              <SpaceRow key={space.id} space={space} />
            ))}
          </div>
          {hasNextPage && (
            <Button
              variant="subtle"
              fullWidth
              mt="sm"
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            >
              {t("Load more")}
            </Button>
          )}
        </>
      ) : isError ? (
        <EmptyState
          icon={IconAlertTriangle}
          title={t("Something went wrong")}
          action={
            <Button
              variant="default"
              size="sm"
              mt="xs"
              onClick={() => refetch()}
            >
              {t("Try again")}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={IconLayoutGrid}
          title={isSelf ? t("No spaces yet") : t("No shared spaces")}
          description={
            isSelf
              ? t("Spaces you join will show up here.")
              : t("You don't share any spaces.")
          }
        />
      )}
    </UserProfileCard>
  );
}

function SpaceRow({ space }: { space: IUserProfileSpace }) {
  return (
    <Link
      to={getSpaceUrl(space.slug)}
      className={classes.spaceRow}
      onMouseEnter={() => prefetchSpace(space.slug, space.id)}
    >
      <CustomAvatar
        name={space.name}
        avatarUrl={space.logo}
        type={AvatarIconType.SPACE_ICON}
        color="initials"
        variant="filled"
        size={24}
      />
      <span className={classes.spaceName}>{space.name}</span>
    </Link>
  );
}
