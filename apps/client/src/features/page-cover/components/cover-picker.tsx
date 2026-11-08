import React, { useId, useRef, useState } from "react";
import {
  Button,
  FileButton,
  Loader,
  Popover,
  ScrollArea,
  Tabs,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconPhotoUp } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import classes from "./cover-picker.module.css";
import { IPage } from "@/features/page/types/page.types.ts";
import { isUnsplashEnabled } from "@/lib/config.ts";
import { usePageCover } from "@/features/page-cover/hooks/use-page-cover.ts";
import { UnsplashPanel } from "@/features/page-cover/components/unsplash-panel.tsx";
import {
  COVER_COLOR_PRESETS,
  COVER_GRADIENT_PRESETS,
  COVER_IMAGE_TYPES,
  COVER_TEXTURE_PRESETS,
} from "@/features/page-cover/page-cover.constants.ts";
import {
  getCoverCredit,
  isUploadedCover,
  resolveCover,
  toCoverValue,
  toCssUrl,
  toUnsplashCoverValue,
} from "@/features/page-cover/page-cover.utils.ts";
import {
  CoverPreset,
  PageCoverFields,
} from "@/features/page-cover/page-cover.types.ts";

type CoverPickerProps = {
  page: IPage;
  opened: boolean;
  onChange: (opened: boolean) => void;
  dropdownId: string;
  children: React.ReactElement;
};

export function CoverPicker({
  page,
  opened,
  onChange,
  dropdownId,
  children,
}: CoverPickerProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string | null>("gallery");
  const [unsplashSearch, setUnsplashSearch] = useState("");
  const [wasOpened, setWasOpened] = useState(opened);
  const [openedWith, setOpenedWith] = useState<PageCoverFields | null>(null);
  const { updateCover, uploadCover, selectUnsplashPhoto, isUploading } =
    usePageCover(page);
  const unsplashEnabled = isUnsplashEnabled();

  if (opened !== wasOpened) {
    setWasOpened(opened);
    if (opened) {
      setOpenedWith({
        coverPhoto: page.coverPhoto,
        coverPosition: page.coverPosition ?? null,
        coverAttribution: page.coverAttribution ?? null,
      });
    }
  }

  const openedCredit = getCoverCredit(
    openedWith?.coverPhoto,
    openedWith?.coverAttribution,
  );
  // an Unsplash photo is looked up again, so it needs Unsplash to be on
  const openedCover =
    isUploadedCover(openedWith?.coverPhoto) || (openedCredit && unsplashEnabled)
      ? resolveCover(openedWith.coverPhoto)
      : null;
  const currentCredit = getCoverCredit(page.coverPhoto, page.coverAttribution);
  // a restored photo comes back with a new address, so photos match by id
  const openedIsCurrent = openedCredit
    ? currentCredit?.photoId === openedCredit.photoId
    : page.coverPhoto === openedWith?.coverPhoto;

  const selectPreset = (preset: CoverPreset) => {
    const coverPhoto = toCoverValue(preset);
    if (coverPhoto === page.coverPhoto) return;
    updateCover({ coverPhoto });
  };

  const restoreOpenedCover = () => {
    if (!openedWith || openedIsCurrent) return;
    const coverPosition = openedWith.coverPosition ?? null;
    if (openedCredit) {
      updateCover({
        coverPhoto: toUnsplashCoverValue(openedCredit.photoId),
        coverPosition,
        preview: {
          coverPhoto: openedWith.coverPhoto,
          coverAttribution: openedCredit,
        },
      });
      return;
    }
    updateCover({ coverPhoto: openedWith.coverPhoto, coverPosition });
  };

  const uploadImage = async (file: File | null) => {
    if (!file || isUploading) return;
    if (!COVER_IMAGE_TYPES.includes(file.type)) {
      notifications.show({
        message: t("Use a JPG, PNG or WebP image."),
        color: "red",
      });
      return;
    }
    if (await uploadCover(file)) onChange(false);
  };

  return (
    <Popover
      opened={opened}
      onChange={onChange}
      position="bottom-end"
      shadow="lg"
      offset={20}
      trapFocus
      returnFocus
      withRoles={false}
      middlewares={{
        // never flip over the cover being previewed; scroll instead
        flip: false,
        shift: { padding: 12 },
        size: {
          padding: 12,
          apply: ({ availableHeight, elements }) => {
            elements.floating.style.setProperty(
              "--cover-picker-available-height",
              `${availableHeight}px`,
            );
          },
        },
      }}
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown
        id={dropdownId}
        role="dialog"
        aria-label={t("Change cover")}
        p={0}
        style={{ width: "min(520px, calc(100vw - 24px))" }}
      >
        <Tabs
          value={tab}
          onChange={setTab}
          variant="default"
          color="dark"
          keepMounted={false}
        >
          <div className={classes.header}>
            <Tabs.List className={classes.tabList}>
              <Tabs.Tab value="gallery">{t("Gallery")}</Tabs.Tab>
              <Tabs.Tab value="upload">{t("Upload")}</Tabs.Tab>
              {unsplashEnabled && <Tabs.Tab value="unsplash">Unsplash</Tabs.Tab>}
            </Tabs.List>
          </div>

          <Tabs.Panel value="gallery">
            <ScrollArea.Autosize
              mah="max(160px, calc(var(--cover-picker-available-height, 480px) - 50px))"
              type="auto"
              scrollbarSize={6}
              style={{ overscrollBehavior: "contain" }}
            >
              <div className={classes.body}>
                {openedCover?.kind === "image" && (
                  <TileGroup title={openedCredit ? "Unsplash" : t("Uploaded")}>
                    <CoverTile
                      label={
                        openedCredit
                          ? t("Photo by {{name}}", {
                              name: openedCredit.authorName,
                            })
                          : t("Uploaded image")
                      }
                      selected={openedIsCurrent}
                      style={{ backgroundImage: toCssUrl(openedCover.src) }}
                      onClick={restoreOpenedCover}
                    />
                  </TileGroup>
                )}
                <PresetGroup
                  title={t("Colors")}
                  presets={COVER_COLOR_PRESETS}
                  current={page.coverPhoto}
                  onSelect={selectPreset}
                  compact
                />
                <PresetGroup
                  title={t("Gradients")}
                  presets={COVER_GRADIENT_PRESETS}
                  current={page.coverPhoto}
                  onSelect={selectPreset}
                />
                <PresetGroup
                  title={t("Textures")}
                  presets={COVER_TEXTURE_PRESETS}
                  current={page.coverPhoto}
                  onSelect={selectPreset}
                />
              </div>
            </ScrollArea.Autosize>
          </Tabs.Panel>

          <Tabs.Panel value="upload">
            <div className={classes.body}>
              <UploadDropzone uploading={isUploading} onFile={uploadImage} />
            </div>
          </Tabs.Panel>

          {unsplashEnabled && (
            <Tabs.Panel value="unsplash">
              <UnsplashPanel
                pageId={page.id}
                search={unsplashSearch}
                onSearchChange={setUnsplashSearch}
                selectedPhotoId={currentCredit?.photoId ?? null}
                onSelect={selectUnsplashPhoto}
              />
            </Tabs.Panel>
          )}
        </Tabs>
      </Popover.Dropdown>
    </Popover>
  );
}

type TileGroupProps = {
  title: string;
  compact?: boolean;
  children: React.ReactNode;
};

function TileGroup({ title, compact, children }: TileGroupProps) {
  const titleId = useId();

  return (
    <div className={classes.section} role="group" aria-labelledby={titleId}>
      <Text
        id={titleId}
        size="xs"
        fw={500}
        c="dimmed"
        className={classes.sectionTitle}
      >
        {title}
      </Text>
      <div className={clsx(classes.grid, compact && classes.colorGrid)}>
        {children}
      </div>
    </div>
  );
}

type PresetGroupProps = {
  title: string;
  presets: CoverPreset[];
  current: string | null;
  onSelect: (preset: CoverPreset) => void;
  compact?: boolean;
};

function PresetGroup({
  title,
  presets,
  current,
  onSelect,
  compact,
}: PresetGroupProps) {
  const { t } = useTranslation();

  return (
    <TileGroup title={title} compact={compact}>
      {presets.map((preset) => (
        <CoverTile
          key={preset.id}
          label={t(preset.label)}
          selected={toCoverValue(preset) === current}
          compact={compact}
          style={
            preset.color
              ? { backgroundColor: preset.color }
              : { backgroundImage: `url("${preset.thumb}")` }
          }
          onClick={() => onSelect(preset)}
        />
      ))}
    </TileGroup>
  );
}

type CoverTileProps = {
  label: string;
  selected: boolean;
  style: React.CSSProperties;
  onClick: () => void;
  compact?: boolean;
};

function CoverTile({ label, selected, style, onClick, compact }: CoverTileProps) {
  return (
    <UnstyledButton
      className={clsx(classes.tile, compact && classes.colorTile)}
      style={style}
      aria-label={label}
      aria-pressed={selected}
      data-selected={selected || undefined}
      data-autofocus={selected || undefined}
      onClick={onClick}
    >
      {selected && (
        <span className={classes.check} aria-hidden>
          <IconCheck size={11} stroke={3} />
        </span>
      )}
    </UnstyledButton>
  );
}

type UploadDropzoneProps = {
  uploading: boolean;
  onFile: (file: File | null) => void;
};

function UploadDropzone({ uploading, onFile }: UploadDropzoneProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);
  const resetFileInput = useRef<() => void>(null);

  // an unchanged input fires no change event, so retrying the same file needs a reset
  const pickFile = (file: File | null) => {
    resetFileInput.current?.();
    onFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    onFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div
      className={classes.dropzone}
      data-dragging={dragging || undefined}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <IconPhotoUp size={28} stroke={1.5} className={classes.dropIcon} />
      <FileButton
        resetRef={resetFileInput}
        onChange={pickFile}
        accept={COVER_IMAGE_TYPES.join(",")}
      >
        {(props) => (
          // stays focusable while uploading, a disabled button would drop focus
          <Button
            {...props}
            variant="default"
            aria-disabled={uploading || undefined}
            leftSection={uploading ? <Loader size={14} /> : undefined}
            onClick={uploading ? undefined : props.onClick}
          >
            {t("Upload image")}
          </Button>
        )}
      </FileButton>
      <Text size="xs" c="dimmed">
        {t("Or drop an image here. Use an image at least 1200 pixels wide.")}
      </Text>
      <VisuallyHidden role="status">
        {uploading ? t("Uploading image") : ""}
      </VisuallyHidden>
    </div>
  );
}
