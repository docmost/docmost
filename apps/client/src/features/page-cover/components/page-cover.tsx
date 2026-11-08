import React, { useEffect, useId, useRef, useState } from "react";
import { Button, Container } from "@mantine/core";
import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import classes from "./page-cover.module.css";
import { IPage } from "@/features/page/types/page.types.ts";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { currentPageEditModeAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { usePageCover } from "@/features/page-cover/hooks/use-page-cover.ts";
import { CoverPicker } from "@/features/page-cover/components/cover-picker.tsx";
import { CoverImage } from "@/features/page-cover/components/cover-image.tsx";
import { DEFAULT_COVER_POSITION } from "@/features/page-cover/page-cover.constants.ts";
import {
  getCoverOverflow,
  getCoverPositionAfterDrag,
  resolveCover,
} from "@/features/page-cover/page-cover.utils.ts";
import { ResolvedCover } from "@/features/page-cover/page-cover.types.ts";

type PageCoverProps = {
  page: IPage;
  editable: boolean;
};

export function PageCover({ page, editable }: PageCoverProps) {
  const cover = resolveCover(page.coverPhoto);
  if (!cover) return null;
  return <PageCoverBand page={page} cover={cover} editable={editable} />;
}

type PageCoverBandProps = PageCoverProps & { cover: ResolvedCover };

const pillButtonProps = {
  variant: "default",
  size: "compact-sm",
  fw: 500,
  fz: 13,
} as const;

type DragState = { startY: number; startPosition: number; overflow: number };

function PageCoverBand({ page, cover, editable }: PageCoverBandProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const user = useAtomValue(userAtom);
  const fullPageWidth = user?.settings?.preferences?.fullPageWidth;
  const editMode = useAtomValue(currentPageEditModeAtom);
  const canEdit = editable && editMode === PageEditMode.Edit;
  const { updateCover } = usePageCover(page);

  const [pickerOpened, setPickerOpened] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [draft, setDraft] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const coverRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragSurfaceRef = useRef<HTMLDivElement>(null);
  const repositionButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const imageSrc = cover.kind === "image" ? cover.src : null;
  const failed = imageSrc !== null && failedSrc === imageSrc;
  const savedPosition = page.coverPosition ?? DEFAULT_COVER_POSITION;
  const repositioning = draft !== null;
  const position = draft ?? savedPosition;

  useEffect(() => {
    setDraft(null);
  }, [page.coverPhoto]);

  useEffect(() => {
    if (repositioning) dragSurfaceRef.current?.focus();
  }, [repositioning]);

  if (failed && !canEdit) return null;

  const finishRepositioning = () => {
    dragRef.current = null;
    setDragging(false);
    setDraft(null);
    requestAnimationFrame(() => repositionButtonRef.current?.focus());
  };

  const savePosition = () => {
    if (draft === null) return;
    const rounded = Math.round(draft * 100) / 100;
    if (rounded !== savedPosition) {
      updateCover({ coverPosition: rounded });
    }
    finishRepositioning();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !imageRef.current || !coverRef.current) return;
    const image = imageRef.current;
    const box = coverRef.current.getBoundingClientRect();
    dragRef.current = {
      startY: event.clientY,
      startPosition: position,
      overflow: getCoverOverflow(
        { width: image.naturalWidth, height: image.naturalHeight },
        { width: box.width, height: box.height },
      ),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setDraft(
      getCoverPositionAfterDrag(
        drag.startPosition,
        event.clientY - drag.startY,
        drag.overflow,
      ),
    );
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 1;
    const nudge = (delta: number) =>
      setDraft((current) =>
        Math.min(100, Math.max(0, (current ?? savedPosition) + delta)),
      );

    if (event.key === "ArrowUp") {
      event.preventDefault();
      nudge(step);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      nudge(-step);
    } else if (event.key === "Enter") {
      event.preventDefault();
      savePosition();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      finishRepositioning();
    }
  };

  return (
    <div
      ref={coverRef}
      className={clsx(classes.cover, "print-hide")}
      data-active={pickerOpened || repositioning || undefined}
    >
      {cover.kind === "color" ? (
        <div className={classes.fill} style={{ backgroundColor: cover.color }} />
      ) : (
        !failed && (
          <CoverImage
            key={cover.src}
            src={cover.src}
            position={position}
            imageRef={imageRef}
            onError={() => setFailedSrc(cover.src)}
          />
        )
      )}

      {repositioning && (
        <>
          <div
            ref={dragSurfaceRef}
            className={classes.dragSurface}
            data-dragging={dragging || undefined}
            role="slider"
            tabIndex={0}
            aria-label={t("Cover position")}
            aria-describedby={hintId}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
          <span id={hintId} className={classes.hint}>
            {t("Drag image to reposition")}
          </span>
        </>
      )}

      {canEdit && (
        <div className={classes.controls}>
          <Container fluid={fullPageWidth} size={!fullPageWidth && 900}>
            <div className={classes.controlsInner}>
              {repositioning ? (
                <Button.Group>
                  <Button {...pillButtonProps} onClick={savePosition}>
                    {t("Save position")}
                  </Button>
                  <Button {...pillButtonProps} onClick={finishRepositioning}>
                    {t("Cancel")}
                  </Button>
                </Button.Group>
              ) : (
                <CoverPicker
                  page={page}
                  opened={pickerOpened}
                  onChange={setPickerOpened}
                >
                  <Button.Group>
                    <Button
                      {...pillButtonProps}
                      aria-haspopup="dialog"
                      aria-expanded={pickerOpened}
                      onClick={() => setPickerOpened((opened) => !opened)}
                    >
                      {t("Change cover")}
                    </Button>
                    {cover.kind === "image" && !failed && (
                      <Button
                        {...pillButtonProps}
                        ref={repositionButtonRef}
                        onClick={() => setDraft(savedPosition)}
                      >
                        {t("Reposition")}
                      </Button>
                    )}
                  </Button.Group>
                </CoverPicker>
              )}
            </div>
          </Container>
        </div>
      )}
    </div>
  );
}

