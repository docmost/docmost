import {
  Button,
  ScrollArea,
  Skeleton,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { Trans, useTranslation } from "react-i18next";
import classes from "./cover-picker.module.css";
import { useUnsplashPhotosQuery } from "@/features/page-cover/queries/unsplash-query.ts";
import { UnsplashPhoto } from "@/features/page-cover/page-cover.types.ts";
import {
  UNSPLASH_HOME_URL,
  UNSPLASH_SEARCH_DEBOUNCE_MS,
  UNSPLASH_SKELETON_COUNT,
} from "@/features/page-cover/page-cover.constants.ts";
import { getUnsplashProfileUrl } from "@/features/page-cover/page-cover.utils.ts";

type UnsplashPanelProps = {
  search: string;
  onSearchChange: (search: string) => void;
  selectedPhotoId: string | null;
  onSelect: (photo: UnsplashPhoto) => void;
};

export function UnsplashPanel({
  search,
  onSearchChange,
  selectedPhotoId,
  onSelect,
}: UnsplashPanelProps) {
  const { t } = useTranslation();
  const [query] = useDebouncedValue(search.trim(), UNSPLASH_SEARCH_DEBOUNCE_MS);
  const {
    data,
    error,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useUnsplashPhotosQuery(query);
  const photos = data?.pages.flatMap((page) => page.items) ?? [];
  const rateLimited = (error as any)?.response?.status === 429;

  return (
    <>
      <div className={classes.searchRow}>
        <TextInput
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={t("Search photos")}
          aria-label={t("Search Unsplash")}
          leftSection={<IconSearch size={16} stroke={1.75} />}
          maxLength={100}
        />
      </div>
      <ScrollArea.Autosize
        mah="max(160px, calc(var(--cover-picker-available-height, 480px) - 102px))"
        type="auto"
        scrollbarSize={6}
        style={{ overscrollBehavior: "contain" }}
      >
        <div className={classes.photoBody}>
          {isPending ? (
            <div className={classes.photoGrid} aria-hidden>
              {Array.from({ length: UNSPLASH_SKELETON_COUNT }, (_, index) => (
                <Skeleton key={index} className={classes.photoSkeleton} />
              ))}
            </div>
          ) : error && photos.length === 0 ? (
            <div className={classes.photoMessage} role="alert">
              <Text size="sm" c="dimmed">
                {rateLimited
                  ? t("Unsplash rate limit reached. Try again later.")
                  : t("Failed to load photos")}
              </Text>
              {!rateLimited && (
                <Button variant="default" size="xs" onClick={() => refetch()}>
                  {t("Try again")}
                </Button>
              )}
            </div>
          ) : photos.length === 0 ? (
            <div className={classes.photoMessage}>
              <Text size="sm" c="dimmed">
                {t("No photos match your search.")}
              </Text>
            </div>
          ) : (
            <div className={classes.photoGrid}>
              {photos.map((photo) => (
                <UnsplashTile
                  key={photo.id}
                  photo={photo}
                  selected={photo.id === selectedPhotoId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}

          {hasNextPage && (
            <Button
              variant="default"
              size="xs"
              fullWidth
              mt="sm"
              loading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {t("Load more")}
            </Button>
          )}

          <Text size="xs" c="dimmed" className={classes.photoSource}>
            <Trans
              i18nKey="Photos from <unsplash>Unsplash</unsplash>"
              components={{
                unsplash: (
                  <a
                    href={UNSPLASH_HOME_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
              }}
            />
          </Text>
        </div>
      </ScrollArea.Autosize>
    </>
  );
}

type UnsplashTileProps = {
  photo: UnsplashPhoto;
  selected: boolean;
  onSelect: (photo: UnsplashPhoto) => void;
};

function UnsplashTile({ photo, selected, onSelect }: UnsplashTileProps) {
  const { t } = useTranslation();
  const label = photo.description
    ? t("{{description}}, photo by {{name}}", {
        description: photo.description,
        name: photo.authorName,
      })
    : t("Photo by {{name}}", { name: photo.authorName });

  return (
    <div className={classes.photoTile} data-selected={selected || undefined}>
      <UnstyledButton
        className={classes.photoButton}
        style={{ backgroundColor: photo.color ?? undefined }}
        aria-label={label}
        aria-pressed={selected}
        onClick={() => {
          if (!selected) onSelect(photo);
        }}
      >
        <img
          src={photo.thumbUrl}
          alt=""
          loading="lazy"
          draggable={false}
          className={classes.photoImage}
        />
      </UnstyledButton>
      <span className={classes.photoCreditBar}>
        {/* the button already names the photographer for keyboard users */}
        <a
          href={getUnsplashProfileUrl(photo.authorUsername)}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={-1}
          className={classes.photoCredit}
        >
          {photo.authorName}
        </a>
      </span>
      {selected && (
        <span className={classes.check} aria-hidden>
          <IconCheck size={11} stroke={3} />
        </span>
      )}
    </div>
  );
}
