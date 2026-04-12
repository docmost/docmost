import { ActionIcon, Tooltip } from "@mantine/core";
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
  size?: number;
};

function getEntityId(props: StarButtonProps): string | undefined {
  if (props.type === "page") return props.pageId;
  if (props.type === "space") return props.spaceId;
  if (props.type === "template") return props.templateId;
  return undefined;
}

export default function StarButton(props: StarButtonProps) {
  const { type, size = 18 } = props;
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
      removeMutation.mutate(params);
    } else {
      addMutation.mutate(params);
    }
  };

  return (
    <Tooltip
      label={isFavorited ? t("Remove from favorites") : t("Add to favorites")}
      openDelay={250}
      withArrow
    >
      <ActionIcon
        variant="subtle"
        color={isFavorited ? "yellow" : "gray"}
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
