import { ActionIcon, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconStar, IconStarFilled } from "@tabler/icons-react";
import {
  useFavoriteIds,
  useAddFavoriteMutation,
  useRemoveFavoriteMutation,
} from "../queries/favorite-query";
import { FavoriteType } from "../types/favorite.types";
import { ToggleFavoriteParams } from "../services/favorite-service";
import { useTranslation } from "react-i18next";

type StarButtonProps = {
  type: FavoriteType;
  pageId?: string;
  spaceId?: string;
  templateId?: string;
  /** Name of the item being favorited, used to make the button's accessible name descriptive. */
  name?: string;
  size?: number;
};

function getEntityId(props: StarButtonProps): string | undefined {
  if (props.type === "page") return props.pageId;
  if (props.type === "space") return props.spaceId;
  if (props.type === "template") return props.templateId;
  return undefined;
}

export default function StarButton(props: StarButtonProps) {
  const { type, name, size = 18 } = props;
  const { t } = useTranslation();
  const favoriteIds = useFavoriteIds(type);
  const addMutation = useAddFavoriteMutation();
  const removeMutation = useRemoveFavoriteMutation();

  const entityId = getEntityId(props);
  const isFavorited = entityId ? favoriteIds.has(entityId) : false;
  const isPending = addMutation.isPending || removeMutation.isPending;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const params: ToggleFavoriteParams = {
      type,
      pageId: props.pageId,
      spaceId: props.spaceId,
      templateId: props.templateId,
    };

    if (isFavorited) {
      removeMutation.mutate(params, {
        onSuccess: () => {
          notifications.show({
            message: name
              ? t("Removed {{name}} from favorites", { name })
              : t("Removed from favorites"),
          });
        },
      });
    } else {
      addMutation.mutate(params, {
        onSuccess: () => {
          notifications.show({
            message: name
              ? t("Added {{name}} to favorites", { name })
              : t("Added to favorites"),
          });
        },
      });
    }
  };

  // Tooltip label stays short. Accessible name expands to include the item
  // so screen reader users can distinguish stars on different rows.
  const tooltipLabel = isFavorited
    ? t("Remove from favorites")
    : t("Add to favorites");

  const ariaLabel = name
    ? isFavorited
      ? t("Remove {{name}} from favorites", { name })
      : t("Add {{name}} to favorites", { name })
    : tooltipLabel;

  return (
    <Tooltip label={tooltipLabel} openDelay={250} withArrow>
      <ActionIcon
        variant="subtle"
        color={isFavorited ? "yellow" : "gray"}
        aria-label={ariaLabel}
        aria-pressed={isFavorited}
        onClick={handleToggle}
        loading={isPending}
      >
        {isFavorited ? (
          <IconStarFilled size={size} />
        ) : (
          <IconStar size={size} stroke={2} />
        )}
      </ActionIcon>
    </Tooltip>
  );
}
