import { ActionIcon } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import clsx from "clsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import { FilePreviewFrame } from "./file-preview-frame";
import classes from "./microsoft-file.module.css";

type Props = {
  items: MicrosoftFileItem[];
  onFullscreen: (item: MicrosoftFileItem) => void;
};

export function FileCarousel({ items, onFullscreen }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, items.length - 1);
  const indexAfter = (delta: number) => (safeIndex + delta + items.length) % items.length;
  const go = (delta: number) => setIndex(indexAfter(delta));
  const previous = items[indexAfter(-1)];
  const next = items[indexAfter(1)];

  return (
    <div
      className={classes.carousel}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          event.stopPropagation();
        }
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
      }}
    >
      <div className={classes.carouselStage}>
        <FilePreviewFrame
          key={`${items[safeIndex].driveId}:${items[safeIndex].itemId}`}
          item={items[safeIndex]}
          onFullscreen={onFullscreen}
        />
      </div>
      <ActionIcon
        className={clsx(classes.carouselNav, classes.carouselPrev)}
        variant="default"
        radius="xl"
        aria-label={t("Previous file: {{name}}", { name: previous.name || previous.webUrl })}
        onClick={() => go(-1)}
      >
        <IconChevronLeft size={18} />
      </ActionIcon>
      <ActionIcon
        className={clsx(classes.carouselNav, classes.carouselNext)}
        variant="default"
        radius="xl"
        aria-label={t("Next file: {{name}}", { name: next.name || next.webUrl })}
        onClick={() => go(1)}
      >
        <IconChevronRight size={18} />
      </ActionIcon>
      <div className={classes.dots}>
        {items.map((item, dotIndex) => (
          <button
            key={`${item.driveId}:${item.itemId}`}
            type="button"
            className={clsx(classes.dot, dotIndex === safeIndex && classes.dotActive)}
            aria-label={item.name}
            onClick={() => setIndex(dotIndex)}
          />
        ))}
      </div>
    </div>
  );
}
