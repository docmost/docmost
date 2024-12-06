import { Text, Avatar, SimpleGrid, Card, rem } from "@mantine/core";
import React from "react";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import classes from "./space-grid.module.css";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";

export default function SpaceGrid() {
  const { t } = useTranslation();
  const { data, isLoading } = useGetSpacesQuery();

  const cards = data?.items.map((space, index) => (
    <Card
      key={space.id}
      p="xs"
      radius="md"
      component={Link}
      to={getSpaceUrl(space.slug)}
      className={classes.card}
      withBorder
    >
      <Card.Section className={classes.cardSection} h={40}></Card.Section>
      <Avatar
        name={space.name}
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
      <Text fz="sm" fw={500} mb={"md"}>
        {t("Spaces you belong to")}
      </Text>

      <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }}>{cards}</SimpleGrid>
    </>
  );
}
