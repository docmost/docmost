import { ReactElement, useState } from "react";
import { Badge, Button, Group, HoverCard, Skeleton, Text } from "@mantine/core";
import { IconMail } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { useUserProfileQuery } from "@/features/user/queries/user-query";
import { getUserProfileUrl } from "@/lib/config";
import classes from "./user-hover-card.module.css";

type UserHoverCardProps = {
  userId: string;
  children: ReactElement;
};

export function UserHoverCard({ userId, children }: UserHoverCardProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const { data: profile, isError } = useUserProfileQuery(userId, {
    enabled: opened,
  });

  let content;
  if (isError) {
    content = (
      <Text size="sm" c="dimmed">
        {t("Profile unavailable")}
      </Text>
    );
  } else if (!profile) {
    content = (
      <div
        className={classes.card}
        role="status"
        aria-busy="true"
        aria-label={t("Loading profile")}
      >
        <div className={classes.identity} aria-hidden="true">
          <Skeleton circle height={48} flex="none" />
          <Skeleton height={16} width={120} radius="xs" />
        </div>
        <div className={classes.meta} aria-hidden="true">
          <Skeleton height={14} width={170} radius="xs" my={2} />
          <Skeleton height={14} width={130} radius="xs" my={2} />
        </div>
        <Skeleton height={30} radius="sm" aria-hidden="true" />
      </div>
    );
  } else {
    content = (
      <div className={classes.card}>
        <div className={classes.identity}>
          <CustomAvatar
            avatarUrl={profile.avatarUrl}
            name={profile.name}
            size={48}
            variant="filled"
          />
          <div className={classes.identityBody}>
            <Group gap={6}>
              <Text fw={600} className={classes.name}>
                {profile.name}
              </Text>
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
          </div>
        </div>

        {profile.email && (
          <div className={classes.meta}>
            <div className={classes.metaItem}>
              <IconMail size={16} aria-hidden style={{ flex: "none" }} />
              <Text span fz="sm" c="dimmed" className={classes.metaText}>
                {profile.email}
              </Text>
            </div>
          </div>
        )}

        <Button
          variant="default"
          fullWidth
          component={Link}
          to={getUserProfileUrl(profile.id)}
        >
          {t("View profile")}
        </Button>
      </div>
    );
  }

  return (
    <HoverCard
      position="bottom-start"
      shadow="md"
      radius="md"
      openDelay={300}
      closeDelay={150}
      width={280}
      onOpen={() => setOpened(true)}
      onClose={() => setOpened(false)}
    >
      <HoverCard.Target>{children}</HoverCard.Target>
      <HoverCard.Dropdown p="md">{content}</HoverCard.Dropdown>
    </HoverCard>
  );
}
