import { ReactNode } from "react";
import { Badge, Button, Group, Paper, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  IconCalendar,
  IconClock,
  IconLink,
  IconMail,
  IconPencil,
} from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { UserLocalTime } from "@/features/user/components/user-local-time";
import { IUserProfile } from "@/features/user/types/user.types";
import { getUserRoleLabel } from "@/features/workspace/types/user-role-data";
import { useClipboard } from "@/hooks/use-clipboard";
import APP_ROUTE from "@/lib/app-route";
import { getAppUrl, getUserProfileUrl } from "@/lib/config";
import { formatLocalized, useDateFnsLocale } from "@/lib/date-locale";
import classes from "@/features/user/components/profile/user-profile.module.css";

type UserProfileHeaderProps = {
  profile: IUserProfile;
  actions?: ReactNode;
};

export function UserProfileHeader({ profile, actions }: UserProfileHeaderProps) {
  const { t } = useTranslation();
  const locale = useDateFnsLocale();
  const clipboard = useClipboard({ timeout: 500 });
  const currentUser = useAtomValue(userAtom);
  const isSelf = profile.id === currentUser?.id;

  const handleCopyLink = () => {
    clipboard.copy(getAppUrl() + getUserProfileUrl(profile.id));
    notifications.show({ message: t("Link copied") });
  };

  return (
    <Paper withBorder radius="md" p="lg">
      <div className={classes.header}>
        <CustomAvatar
          avatarUrl={profile.avatarUrl}
          name={profile.name}
          size={72}
          variant="filled"
        />

        <div className={classes.headerBody}>
          <Group gap="xs">
            <Title order={1} size="h2" className={classes.name}>
              {profile.name}
            </Title>
            <Badge variant="light" color="gray">
              {t(getUserRoleLabel(profile.role))}
            </Badge>
            {profile.deletedAt ? (
              <Badge variant="light" color="red">
                {t("Deleted")}
              </Badge>
            ) : profile.deactivatedAt ? (
              <Badge variant="light" color="orange">
                {t("Deactivated")}
              </Badge>
            ) : null}
          </Group>

          <div className={classes.meta}>
            {profile.email && (
              <span className={classes.metaItem}>
                <IconMail size={16} aria-hidden />
                <Text span fz="sm" c="dimmed">
                  {profile.email}
                </Text>
              </span>
            )}
            {profile.timezone && (
              <span className={classes.metaItem}>
                <IconClock size={16} aria-hidden />
                <UserLocalTime timezone={profile.timezone} />
              </span>
            )}
            <span className={classes.metaItem}>
              <IconCalendar size={16} aria-hidden />
              <Text span fz="sm" c="dimmed">
                {t("Joined {{date}}", {
                  date: formatLocalized(
                    profile.createdAt,
                    "MMMM yyyy",
                    "LLLL yyyy",
                    locale,
                  ),
                })}
              </Text>
            </span>
          </div>
        </div>

        <Group gap="xs" className={classes.actions}>
          <Button
            variant="default"
            leftSection={<IconLink size={16} />}
            onClick={handleCopyLink}
          >
            {t("Copy link")}
          </Button>
          {isSelf && (
            <Button
              variant="default"
              component={Link}
              to={APP_ROUTE.SETTINGS.ACCOUNT.PROFILE}
              leftSection={<IconPencil size={16} />}
            >
              {t("Edit profile")}
            </Button>
          )}
          {actions}
        </Group>
      </div>
    </Paper>
  );
}
