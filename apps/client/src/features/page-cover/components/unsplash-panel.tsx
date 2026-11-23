import {
  Button,
  ScrollArea,
  Skeleton,
  Text,
  TextInput,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { Trans, useTranslation } from "react-i18next";
import classes from "./cover-picker.module.css";
import { useUnsplashPhotosQuery } from "@/features/page-cover/queries/unsplash-query.ts";
import { UnsplashPhoto } from "@/features/page-cover/page-cover.types.ts";
import {
  UNSPLASH_HOME_URL,
  UNSPLASH_LICENSE_URL,
  UNSPLASH_SEARCH_DEBOUNCE_MS,
  UNSPLASH_SKELETON_COUNT,
} from "@/features/page-cover/page-cover.constants.ts";
import {
  getUnsplashProfileUrl,
  mergeUnsplashPages,
} from "@/features/page-cover/page-cover.utils.ts";

type UnsplashPanelProps = {
  pageId: string;
  search: string;
  onSearchChange: (search: string) => void;
  selectedPhotoId: string | null;
  onSelect: (photo: UnsplashPhoto) => void;
};

export function UnsplashPanel({
  pageId,
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
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useUnsplashPhotosQuery(query, pageId);
  const photos = mergeUnsplashPages(data?.pages ?? []);
  const rateLimited = (error as any)?.response?.status === 429;
  const errorMessage = rateLimited
    ? t("Unsplash rate limit reached. Try again later.")
    : t("Failed to load photos");
  const loading =
    isPending || (Boolean(error) && isFetching && photos.length === 0);
  const noResults = !loading && !error && photos.length === 0;

  return (
    <>
      <div className={classes.searchRow}>
        <TextInput
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder={t("Search photos")}
          aria-label={t("Search photos")}
          leftSection={<IconSearch size={16} stroke={1.75} />}
          maxLength={100}
        />
        <VisuallyHidden role="status">
          {noResults ? t("No results found") : ""}
        </VisuallyHidden>
      </div>
      <ScrollArea.Autosize
        mah="max(160px, calc(var(--cover-picker-available-height, 480px) - 140px))"
        type="auto"
        scrollbarSize={6}
        style={{ overscrollBehavior: "contain" }}
      >
        <div className={classes.photoBody}>
          {loading ? (
            <div className={classes.photoGrid} aria-hidden>
              {Array.from({ length: UNSPLASH_SKELETON_COUNT }, (_, index) => (
                <Skeleton key={index} className={classes.photoSkeleton} />
              ))}
            </div>
          ) : error && photos.length === 0 ? (
            <div className={classes.photoMessage} role="alert">
              <Text size="sm" c="dimmed">
                {errorMessage}
              </Text>
              {!rateLimited && (
                <Button variant="default" size="xs" onClick={() => refetch()}>
                  {t("Try again")}
                </Button>
              )}
            </div>
          ) : noResults ? (
            <div className={classes.photoMessage}>
              <Text size="sm" c="dimmed">
                {t("No results found")}
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

          {isFetchNextPageError && (
            <Text size="sm" c="dimmed" ta="center" mt="sm" role="alert">
              {errorMessage}
            </Text>
          )}

          {hasNextPage && !rateLimited && (
            <Button
              variant="subtle"
              size="xs"
              fullWidth
              mt="sm"
              loading={isFetchingNextPage}
              onClick={() => fetchNextPage()}
            >
              {t("Load more")}
            </Button>
          )}
        </div>
      </ScrollArea.Autosize>
      <Text size="xs" c="dimmed" className={classes.photoSource}>
        <Trans
          i18nKey="Photos from <unsplash>Unsplash</unsplash> · <license>License</license>"
          components={{
            unsplash: (
              <a
                href={UNSPLASH_HOME_URL}
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
            license: (
              <a
                href={UNSPLASH_LICENSE_URL}
                target="_blank"
                rel="noopener noreferrer"
              />
            ),
          }}
        />
      </Text>
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
      {/* the button already names the photographer, so this link is for pointers only */}
      <span className={classes.photoCreditBar} aria-hidden>
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
