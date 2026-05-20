import { Text, SimpleGrid, Card, rem, Group, Box, Button } from "@mantine/core";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { getSpaceUrl } from "@/lib/config";
import { prefetchSpace } from "@/features/space/queries/space-query";
import StarButton from "@/features/favorite/components/star-button";
import { IconChevronDown } from "@tabler/icons-react";
import spaceClasses from "../space-grid.module.css";

const INITIAL_COUNT = 8;

export default function FavoriteSpacesGrid() {
  const { t } = useTranslation();
  const { data } = useFavoritesQuery("space");
  const [expanded, setExpanded] = useState(false);

  const allSpaces = (data?.pages.flatMap((p) => p.items) ?? [])
    .filter((fav) => fav.space)
    .sort((a, b) => a.space!.name.localeCompare(b.space!.name));

  if (allSpaces.length === 0) return null;

  const visibleSpaces = expanded
    ? allSpaces
    : allSpaces.slice(0, INITIAL_COUNT);

  return (
    <Box mb="xl">
      <Text size="sm" fw={500} mb="md">
        {t("Favorite spaces")}
      </Text>

      <SimpleGrid cols={{ base: 1, xs: 2, sm: 4 }}>
        {visibleSpaces.map((fav) => (
          <Card
            key={fav.id}
            p="xs"
            radius="md"
            component={Link}
            to={getSpaceUrl(fav.space!.slug)}
            onMouseEnter={() =>
              prefetchSpace(fav.space!.slug, fav.space!.id)
            }
            className={spaceClasses.card}
            withBorder
          >
            <Card.Section className={spaceClasses.cardSection} h={40}>
              <div className={spaceClasses.starButton} data-favorited="true">
                <StarButton
                  type="space"
                  spaceId={fav.space!.id}
                  size={16}
                />
              </div>
            </Card.Section>
            <CustomAvatar
              name={fav.space!.name}
              avatarUrl={fav.space!.logo}
              type={AvatarIconType.SPACE_ICON}
              color="initials"
              variant="filled"
              size="md"
              mt={rem(-20)}
            />
            <Text fz="md" fw={500} mt="xs" className={spaceClasses.title}>
              {fav.space!.name}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      {!expanded && allSpaces.length > INITIAL_COUNT && (
        <Group justify="center" mt="sm">
          <Button
            variant="subtle"
            size="xs"
            rightSection={<IconChevronDown size={14} />}
            onClick={() => setExpanded(true)}
          >
            {t("Show more")}
          </Button>
        </Group>
      )}
    </Box>
  );
}
