import { Button } from "@mantine/core";
import { IconAlertTriangle, IconFiles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { PageListIcon } from "@/components/common/page-list-icon";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { formatLabelListDate } from "@/features/label/utils/format-label-date";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { UserProfileCard } from "@/features/user/components/profile/user-profile-card";
import { UserProfileRecentPagesSkeleton } from "@/features/user/components/profile/user-profile-skeleton";
import { useUserRecentPagesQuery } from "@/features/user/queries/user-query";
import { IUserRecentPage } from "@/features/user/types/user.types";
import { timeAgo } from "@/lib/time";
import labelClasses from "@/features/label/label.module.css";
import classes from "@/features/user/components/profile/user-profile.module.css";

type UserProfileRecentPagesProps = {
  userId: string;
  isSelf: boolean;
};

export function UserProfileRecentPages({
  userId,
  isSelf,
}: UserProfileRecentPagesProps) {
  const { t } = useTranslation();
  const {
    data,
    isPending,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useUserRecentPagesQuery(userId);
  const pages = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <UserProfileCard title={t("Recent pages")}>
      {isPending ? (
        <div role="status" aria-busy="true" aria-label={t("Loading profile")}>
          <UserProfileRecentPagesSkeleton />
        </div>
      ) : pages.length > 0 ? (
        <>
          <div>
            {pages.map((page) => (
              <RecentPageRow key={page.id} page={page} />
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
          icon={IconFiles}
          title={t("No recent pages")}
          description={
            isSelf
              ? t("Pages you create or edit will show up here.")
              : t("Pages they create or edit in your spaces will show up here.")
          }
        />
      )}
    </UserProfileCard>
  );
}

function RecentPageRow({ page }: { page: IUserRecentPage }) {
  const { t } = useTranslation();
  const activityAt = new Date(page.activityAt);
  const time =
    Date.now() - activityAt.getTime() < 24 * 60 * 60 * 1000
      ? timeAgo(activityAt)
      : formatLabelListDate(activityAt);

  return (
    <Link
      to={buildPageUrl(page.space.slug, page.slugId, page.title)}
      className={clsx(labelClasses.row, classes.recentRow)}
    >
      <div className={labelClasses.rowMain}>
        <div className={clsx(labelClasses.rowIcon, classes.pageIcon)}>
          <PageListIcon icon={page.icon} isBase={page.isBase} />
        </div>
        <div className={labelClasses.rowBody}>
          <div className={labelClasses.rowTitle}>
            {getPageTitle(page.title, page.isBase, t)}
          </div>
          <div className={labelClasses.rowMeta}>
            <CustomAvatar
              name={page.space.name}
              avatarUrl={page.space.logo}
              type={AvatarIconType.SPACE_ICON}
              color="initials"
              variant="filled"
              size={18}
            />
            <span>{page.space.name}</span>
            <span className={labelClasses.metaDot} aria-hidden="true">
              •
            </span>
            <span className={labelClasses.rowDate}>
              {page.activity === "edited"
                ? t("Edited {{time}}", { time })
                : t("Created {{time}}", { time })}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
