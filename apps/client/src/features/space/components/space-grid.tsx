import {
  Text,
  Avatar,
  SimpleGrid,
  Card,
  rem,
  Group,
  Box,
  Divider,
} from "@mantine/core";
import {
  prefetchSpace,
  useGetSpacesQuery,
} from "@/features/space/queries/space-query.ts";
import { getSpaceUrl } from "@/lib/config.ts";
import { Link } from "react-router-dom";
import classes from "./space-grid.module.css";
import { formatMemberCount } from "@/lib";
import { useTranslation } from "react-i18next";

const SpaceCard = ({ space, t, isPersonal = false }) => (
  <Card
    key={space.id}
    p={isPersonal ? "sm" : "xs"}
    radius="md"
    component={Link}
    to={space.visibility === "personal" ? "/my-pages" : getSpaceUrl(space.slug)}
    onMouseEnter={() => prefetchSpace(space.slug, space.id)}
    className={`${classes.card} ${isPersonal ? classes.personalCard : ""}`}
    withBorder
  >
    <Card.Section
      className={classes.cardSection}
      h={isPersonal ? 60 : 40}
      style={
        isPersonal ? { backgroundColor: "var(--mantine-color-blue-1)" } : {}
      }
    ></Card.Section>
    <Avatar
      name={isPersonal ? "MP" : space.name}
      color={isPersonal ? "blue" : "initials"}
      variant="filled"
      size={isPersonal ? "lg" : "md"}
      mt={isPersonal ? rem(-28) : rem(-20)}
    />
    <Text
      fz={isPersonal ? "lg" : "md"}
      fw={500}
      mt="xs"
      className={classes.title}
    >
      {space.visibility === "personal" ? t("My Pages") : space.name}
    </Text>
    <Text c="dimmed" size={isPersonal ? "sm" : "xs"} fw={700} mt="md">
      {space.visibility === "personal"
        ? t("Personal space")
        : formatMemberCount(space.memberCount, t)}
    </Text>
  </Card>
);

export default function SpaceGrid() {
  const { t } = useTranslation();
  const { data } = useGetSpacesQuery({ page: 1 });

  if (!data?.items?.length) {
    return null;
  }

  const personalSpace = data.items.find(
    (space) => space.visibility === "personal",
  );

  const otherSpaces = data.items.filter(
    (space) => space.visibility !== "personal",
  );

  return (
    <>
      <Text fz="sm" fw={500} mb="md">
        {t("Spaces you belong to")}
      </Text>

      {personalSpace && (
        <div className={classes.personalSpaceSection}>
          <SpaceCard space={personalSpace} t={t} isPersonal={true} />
        </div>
      )}

      {personalSpace && otherSpaces.length > 0 && (
        <Box mt="xl" mb="md">
          <Text fz="sm" fw={500} mb="xs">
            {t("Other spaces")}
          </Text>
          <Divider my="sm" />
        </Box>
      )}

      {otherSpaces.length > 0 && (
        <SimpleGrid cols={{ base: 1, xs: 2, sm: 3 }} mt="md">
          {otherSpaces.map((space) => (
            <SpaceCard key={space.id} space={space} t={t} isPersonal={false} />
          ))}
        </SimpleGrid>
      )}
    </>
  );
}
