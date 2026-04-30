import { Text, Card, rem, Group, Button, Skeleton } from "@mantine/core";
import {
  prefetchSpace,
  useGetSpacesQuery,
} from "@/features/space/queries/space-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import classes from "./space-carousel.module.css";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";
import { IconArrowRight } from "@tabler/icons-react";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import CardCarousel from "@/components/ui/card-carousel";

function SpaceCardSkeleton() {
  return (
    <Card p="xs" radius="md" withBorder className={classes.card}>
      <Card.Section className={classes.cardSection} h={40} />
      <Skeleton circle height={38} width={38} mt={rem(-20)} />
      <Skeleton height={14} mt="xs" width="70%" radius="xl" />
      <Skeleton height={10} mt="md" width="40%" radius="xl" />
    </Card>
  );
}

export default function SpaceCarousel() {
  const { t } = useTranslation();
  const { data, isPending } = useGetSpacesQuery({ limit: 20 });

  if (isPending) {
    return (
      <>
        <Group justify="space-between" align="center" mb="md">
          <Text fz="sm" fw={500}>
            {t("Spaces you belong to")}
          </Text>
        </Group>
        <CardCarousel ariaLabel={t("Spaces you belong to")}>
          {Array.from({ length: 4 }, (_, i) => (
            <SpaceCardSkeleton key={i} />
          ))}
        </CardCarousel>
      </>
    );
  }

  const cards = data?.items.map((space) => (
    <Card
      key={space.id}
      p="xs"
      radius="md"
      component={Link}
      to={getSpaceUrl(space.slug)}
      onMouseEnter={() => prefetchSpace(space.slug, space.id)}
      className={classes.card}
      withBorder
    >
      <Card.Section className={classes.cardSection} h={40}></Card.Section>
      <CustomAvatar
        name={space.name}
        avatarUrl={space.logo}
        type={AvatarIconType.SPACE_ICON}
        color="initials"
        variant="filled"
        size="md"
        mt={rem(-20)}
      />

      <Text fz="md" fw={500} mt="xs" className={classes.title}>
        {space.name}
      </Text>

      <Text c="dimmed" size="xs" fw={700} mt="md">
        {formatMemberCount(space.memberCount, t)}
      </Text>
    </Card>
  ));

  return (
    <>
      <Group justify="space-between" align="center" mb="md">
        <Text fz="sm" fw={500}>
          {t("Spaces you belong to")}
        </Text>
      </Group>

      <CardCarousel ariaLabel={t("Spaces you belong to")}>{cards}</CardCarousel>

      {data?.items && data.items.length > 1 && (
        <Group justify="flex-end" mt="lg">
          <Button
            component={Link}
            to="/spaces"
            variant="subtle"
            rightSection={<IconArrowRight size={16} />}
            size="sm"
          >
            {t("View all spaces")}
          </Button>
        </Group>
      )}
    </>
  );
}
