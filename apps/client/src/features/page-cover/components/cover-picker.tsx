import React, { useState } from "react";
import {
  Button,
  FileButton,
  Popover,
  ScrollArea,
  Tabs,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPhotoUp } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import classes from "./cover-picker.module.css";
import { IPage } from "@/features/page/types/page.types.ts";
import { usePageCover } from "@/features/page-cover/hooks/use-page-cover.ts";
import {
  COVER_COLOR_PRESETS,
  COVER_GRADIENT_PRESETS,
  COVER_IMAGE_TYPES,
  COVER_TEXTURE_PRESETS,
} from "@/features/page-cover/page-cover.constants.ts";
import { toCoverValue } from "@/features/page-cover/page-cover.utils.ts";
import { CoverPreset } from "@/features/page-cover/page-cover.types.ts";

type CoverPickerProps = {
  page: IPage;
  opened: boolean;
  onChange: (opened: boolean) => void;
  children: React.ReactElement;
};

export function CoverPicker({
  page,
  opened,
  onChange,
  children,
}: CoverPickerProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<string | null>("gallery");
  const { updateCover, uploadCover, isUploading } = usePageCover(page);

  const selectPreset = (preset: CoverPreset) => {
    updateCover({ coverPhoto: toCoverValue(preset) });
  };

  const removeCover = () => {
    onChange(false);
    updateCover({ coverPhoto: null });
  };

  const uploadImage = async (file: File | null) => {
    if (!file) return;
    if (!COVER_IMAGE_TYPES.includes(file.type)) {
      notifications.show({
        message: t("Use a JPG, PNG, WebP or GIF image."),
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
      offset={8}
      trapFocus
      returnFocus
      withRoles={false}
      middlewares={{
        // never flip over the cover being previewed; scroll instead
        flip: false,
        shift: true,
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
        p={0}
        aria-label={t("Change cover")}
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
            </Tabs.List>
            <Button
              variant="subtle"
              color="gray"
              size="compact-sm"
              fw={500}
              onClick={removeCover}
            >
              {t("Remove")}
            </Button>
          </div>

          <Tabs.Panel value="gallery">
            <ScrollArea.Autosize
              mah="calc(var(--cover-picker-available-height, 480px) - 50px)"
              type="auto"
              scrollbarSize={6}
              style={{ overscrollBehavior: "contain" }}
            >
              <div className={classes.body}>
                <PresetSection
                  title={t("Colors")}
                  presets={COVER_COLOR_PRESETS}
                  current={page.coverPhoto}
                  onSelect={selectPreset}
                  compact
                />
                <PresetSection
                  title={t("Gradients")}
                  presets={COVER_GRADIENT_PRESETS}
                  current={page.coverPhoto}
                  onSelect={selectPreset}
                />
                <PresetSection
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
        </Tabs>
      </Popover.Dropdown>
    </Popover>
  );
}

type PresetSectionProps = {
  title: string;
  presets: CoverPreset[];
  current: string | null;
  onSelect: (preset: CoverPreset) => void;
  compact?: boolean;
};

function PresetSection({
  title,
  presets,
  current,
  onSelect,
  compact,
}: PresetSectionProps) {
  const { t } = useTranslation();

  return (
    <section className={classes.section} aria-label={title}>
      <Text size="xs" fw={500} c="dimmed" className={classes.sectionTitle}>
        {title}
      </Text>
      <div className={clsx(classes.grid, compact && classes.colorGrid)}>
        {presets.map((preset) => {
          const selected = toCoverValue(preset) === current;
          return (
            <UnstyledButton
              key={preset.id}
              className={clsx(classes.tile, compact && classes.colorTile)}
              style={
                preset.color
                  ? { backgroundColor: preset.color }
                  : { backgroundImage: `url(${preset.thumb})` }
              }
              aria-label={t(preset.label)}
              aria-pressed={selected}
              data-selected={selected || undefined}
              onClick={() => onSelect(preset)}
            />
          );
        })}
      </div>
    </section>
  );
}

type UploadDropzoneProps = {
  uploading: boolean;
  onFile: (file: File | null) => void;
};

function UploadDropzone({ uploading, onFile }: UploadDropzoneProps) {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (uploading) return;
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
      <FileButton onChange={onFile} accept={COVER_IMAGE_TYPES.join(",")}>
        {(props) => (
          <Button {...props} variant="default" loading={uploading}>
            {t("Upload image")}
          </Button>
        )}
      </FileButton>
      <Text size="xs" c="dimmed">
        {t("Images wider than 1500 pixels work best.")}
      </Text>
    </div>
  );
}
