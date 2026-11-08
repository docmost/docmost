import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Container,
  Text,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconTrash } from "@tabler/icons-react";
import { useAtom, useAtomValue } from "jotai";
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
import { CoverCredit } from "@/features/page-cover/components/cover-credit.tsx";
import { coverFocusRequestAtom } from "@/features/page-cover/atoms/page-cover-atoms.ts";
import {
  COVER_FOCUS_REQUEST_TTL,
  COVER_POSITION_STEP,
} from "@/features/page-cover/page-cover.constants.ts";
import {
  getCoverCredit,
  getCoverOverflow,
  getCoverPosition,
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
  const instructionsId = useId();
  const pickerId = useId();
  const user = useAtomValue(userAtom);
  const fullPageWidth = user?.settings?.preferences?.fullPageWidth;
  const editMode = useAtomValue(currentPageEditModeAtom);
  const canEdit = editable && editMode === PageEditMode.Edit;
  const belowToolbar = canEdit && user?.settings?.preferences?.editorToolbar;
  const { updateCover } = usePageCover(page);
  const [focusRequest, setFocusRequest] = useAtom(coverFocusRequestAtom);

  const [pickerOpened, setPickerOpened] = useState(false);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [draft, setDraft] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const coverRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragSurfaceRef = useRef<HTMLDivElement>(null);
  const changeCoverButtonRef = useRef<HTMLButtonElement>(null);
  const repositionButtonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previousCoverRef = useRef(page.coverPhoto);

  const imageSrc = cover.kind === "image" ? cover.src : null;
  const failed = imageSrc !== null && failedSrc === imageSrc;
  const canReposition = cover.kind === "image" && !failed;
  // credit outside the picker is off for now
  const credit: ReturnType<typeof getCoverCredit> = null;
  // const credit = failed
  //   ? null
  //   : getCoverCredit(page.coverPhoto, page.coverAttribution);
  const savedPosition = getCoverPosition(page.coverPosition);
  const position = draft ?? savedPosition;
  const showReposition = repositioning && canEdit;

  useEffect(() => {
    if (previousCoverRef.current === page.coverPhoto) return;
    previousCoverRef.current = page.coverPhoto;
    setDraft(null);
    if (repositioning) {
      setRepositioning(false);
      requestAnimationFrame(() => changeCoverButtonRef.current?.focus());
    }
  }, [page.coverPhoto]);

  // keep showing the draft until the saved position catches up
  useEffect(() => {
    if (!repositioning) setDraft(null);
  }, [page.coverPosition]);

  useEffect(() => {
    if (canEdit) return;
    setRepositioning(false);
    setDraft(null);
    setPickerOpened(false);
  }, [canEdit]);

  useEffect(() => {
    if (showReposition) dragSurfaceRef.current?.focus();
  }, [showReposition]);

  useEffect(() => {
    if (focusRequest?.pageId !== page.id) return;
    if (focusRequest.target !== "change-cover" || !canEdit) return;
    setFocusRequest(null);
    if (Date.now() - focusRequest.requestedAt > COVER_FOCUS_REQUEST_TTL) return;
    changeCoverButtonRef.current?.focus();
  }, [focusRequest, canEdit]);

  // runs before the band leaves the DOM, so focus inside it can be handed on
  useLayoutEffect(
    () => () => {
      const active = document.activeElement;
      const hadFocus =
        active &&
        (coverRef.current?.contains(active) ||
          document.getElementById(pickerId)?.contains(active));
      if (hadFocus) {
        setFocusRequest({
          pageId: page.id,
          target: "add-cover",
          requestedAt: Date.now(),
        });
      }
    },
    [],
  );

  if (failed && !canEdit) return null;

  const nudge = (delta: number) =>
    setDraft((current) => getCoverPosition((current ?? savedPosition) + delta));

  const startRepositioning = () => {
    setPickerOpened(false);
    setDraft(savedPosition);
    setRepositioning(true);
  };

  const endRepositioning = () => {
    dragRef.current = null;
    setDragging(false);
    setRepositioning(false);
    requestAnimationFrame(() => repositionButtonRef.current?.focus());
  };

  const cancelRepositioning = () => {
    setDraft(null);
    endRepositioning();
  };

  const removeCover = () => {
    setFocusRequest({
      pageId: page.id,
      target: "add-cover",
      requestedAt: Date.now(),
    });
    updateCover({ coverPhoto: null });
  };

  const savePosition = () => {
    const rounded = draft === null ? savedPosition : Math.round(draft * 100) / 100;
    if (rounded !== savedPosition) {
      updateCover({ coverPosition: rounded });
    } else {
      setDraft(null);
    }
    endRepositioning();
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
    const keySteps: Record<string, number> = {
      ArrowUp: event.shiftKey ? COVER_POSITION_STEP : 1,
      ArrowDown: event.shiftKey ? -COVER_POSITION_STEP : -1,
      PageUp: COVER_POSITION_STEP,
      PageDown: -COVER_POSITION_STEP,
      Home: -100,
      End: 100,
    };

    if (event.key in keySteps) {
      event.preventDefault();
      nudge(keySteps[event.key]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      savePosition();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelRepositioning();
    }
  };

  return (
    <div
      ref={coverRef}
      className={clsx(classes.cover, "print-hide")}
      data-active={pickerOpened || showReposition || undefined}
      data-below-toolbar={belowToolbar || undefined}
      // lets a tap reveal the controls on touch screens
      tabIndex={canEdit ? -1 : undefined}
    >
      {cover.kind === "color" ? (
        <div className={classes.fill} style={{ backgroundColor: cover.color }} />
      ) : failed ? (
        <Text size="sm" c="dimmed" className={classes.unavailable}>
          {t("Cover image not found")}
        </Text>
      ) : (
        <CoverImage
          key={cover.src}
          src={cover.src}
          position={position}
          imageRef={imageRef}
          onError={() => setFailedSrc(cover.src)}
        />
      )}

      {showReposition && (
        <>
          <div
            ref={dragSurfaceRef}
            className={classes.dragSurface}
            data-dragging={dragging || undefined}
            role="slider"
            tabIndex={0}
            aria-label={t("Cover position")}
            aria-describedby={`${hintId} ${instructionsId}`}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(position)}
            aria-valuetext={t("{{value}}% from the top", {
              value: Math.round(position),
            })}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
          />
          <span id={hintId} className={classes.hint}>
            {t("Drag the image up or down")}
          </span>
          <VisuallyHidden id={instructionsId}>
            {t(
              "Use the arrow keys to move the image. Press Enter to save or Escape to cancel.",
            )}
          </VisuallyHidden>
        </>
      )}

      {(canEdit || credit) && (
        <div className={classes.controls}>
          <Container fluid={fullPageWidth} size={!fullPageWidth && 900} px={0}>
            <div className={classes.controlsInner}>
              {credit && !showReposition && (
                <CoverCredit attribution={credit} className={classes.bandCredit} />
              )}
              {!canEdit ? null : showReposition ? (
                <Button.Group className={classes.pill}>
                  <Tooltip label={t("Move image up")} withArrow openDelay={250}>
                    <Button
                      {...pillButtonProps}
                      px={8}
                      aria-label={t("Move image up")}
                      onClick={() => nudge(COVER_POSITION_STEP)}
                    >
                      <IconArrowUp size={14} stroke={2} />
                    </Button>
                  </Tooltip>
                  <Tooltip label={t("Move image down")} withArrow openDelay={250}>
                    <Button
                      {...pillButtonProps}
                      px={8}
                      aria-label={t("Move image down")}
                      onClick={() => nudge(-COVER_POSITION_STEP)}
                    >
                      <IconArrowDown size={14} stroke={2} />
                    </Button>
                  </Tooltip>
                  <Button {...pillButtonProps} onClick={savePosition}>
                    {t("Save position")}
                  </Button>
                  <Button {...pillButtonProps} onClick={cancelRepositioning}>
                    {t("Cancel")}
                  </Button>
                </Button.Group>
              ) : (
                <CoverPicker
                  page={page}
                  opened={pickerOpened}
                  onChange={setPickerOpened}
                  dropdownId={pickerId}
                >
                  <div className={classes.pillRow}>
                    <Button.Group className={classes.pill}>
                      <Button
                        {...pillButtonProps}
                        ref={changeCoverButtonRef}
                        aria-haspopup="dialog"
                        aria-expanded={pickerOpened}
                        aria-controls={pickerOpened ? pickerId : undefined}
                        onClick={() => setPickerOpened((opened) => !opened)}
                      >
                        {t("Change cover")}
                      </Button>
                      {canReposition && (
                        <Button
                          {...pillButtonProps}
                          ref={repositionButtonRef}
                          onClick={startRepositioning}
                        >
                          {t("Reposition")}
                        </Button>
                      )}
                    </Button.Group>
                    <Tooltip label={t("Remove cover")} withArrow openDelay={250}>
                      <Button
                        {...pillButtonProps}
                        px={8}
                        className={classes.pill}
                        aria-label={t("Remove cover")}
                        onClick={removeCover}
                      >
                        <IconTrash size={14} stroke={2} />
                      </Button>
                    </Tooltip>
                  </div>
                </CoverPicker>
              )}
            </div>
          </Container>
        </div>
      )}
    </div>
  );
}
