import "@/features/editor/styles/index.css";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActionIcon,
  Box,
  Button,
  Center,
  Divider,
  Modal,
  Title,
  Tooltip,
  VisuallyHidden,
} from "@mantine/core";
import {
  IconAlertTriangle,
  IconChevronLeft,
  IconChevronRight,
  IconMaximize,
  IconMinimize,
  IconPointer,
  IconX,
} from "@tabler/icons-react";
import { useFullscreenDocument, useWindowEvent } from "@mantine/hooks";
import {
  type Content,
  type Editor,
  EditorProvider,
  type JSONContent,
  useCurrentEditor,
} from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { UniqueID } from "@docmost/editor-ext";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import clsx from "clsx";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import { extractPageSlugId } from "@/lib";
import LaserPointer from "./laser-pointer";
import {
  findSlideIndexForNode,
  getContentBoxHeight,
  getDeckKeyAction,
  measureBlocks,
  paginateBlocks,
  sameSlideLayouts,
  setEditorPageId,
  shouldReturnFocusToSlide,
  type SlideLayout,
} from "./presentation.utils";
import classes from "./presentation-modal.module.css";

type PresentationModalProps = {
  pageId: string;
  title: string;
  content: Content;
  opened: boolean;
  onClose: () => void;
};

type PresentationDeckProps = Omit<PresentationModalProps, "opened">;

type DeckState = {
  slides: SlideLayout[] | null;
  nodes: JSONContent[];
  index: number;
};

type NodesCache = {
  doc: ProseMirrorNode;
  nodes: JSONContent[];
};

const excludedExtensionNames = new Set([
  "uniqueID",
  "trailingNode",
  "tableHeaderPin",
  "tableReadonlySort",
]);

const presentationExtensions = [
  ...mainExtensions.filter((ext) => !excludedExtensionNames.has(ext.name)),
  UniqueID.configure({
    types: ["heading", "paragraph"],
    updateDocument: false,
  }),
];

export default function PresentationModal({
  pageId,
  title,
  content,
  opened,
  onClose,
}: PresentationModalProps) {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);

  useEffect(() => {
    if (opened) {
      onClose();
    }
  }, [pageSlugId]);

  useEffect(() => {
    if (!opened) return;
    // keeps focus, clicks and find-in-page out of the live page behind the deck
    const root = document.getElementById("root");
    root?.setAttribute("inert", "");
    return () => root?.removeAttribute("inert");
  }, [opened]);

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      fullScreen
      closeOnEscape
      transitionProps={{ duration: 150 }}
    >
      <Modal.Overlay />
      <Modal.Content
        className={classes.content}
        aria-label={t("Presentation mode")}
      >
        <Modal.Body className={classes.body}>
          <ErrorBoundary
            fallback={
              <Center h="100%">
                <EmptyState
                  icon={IconAlertTriangle}
                  title={t("Failed to load presentation. An error occurred.")}
                  action={
                    <Button
                      variant="default"
                      size="sm"
                      mt="xs"
                      onClick={onClose}
                    >
                      {t("Close")}
                    </Button>
                  }
                />
              </Center>
            }
          >
            <PresentationDeck
              pageId={pageId}
              title={title}
              content={content}
              onClose={onClose}
            />
          </ErrorBoundary>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

function PresentationDeck({
  pageId,
  title,
  content,
  onClose,
}: PresentationDeckProps) {
  const { t } = useTranslation();
  const [deck, setDeck] = useState<DeckState>({
    slides: null,
    nodes: [],
    index: 0,
  });
  const stageRef = useRef<HTMLDivElement>(null);
  const measurementAreaRef = useRef<HTMLDivElement>(null);
  const slideAreaRef = useRef<HTMLDivElement>(null);
  const lastLayoutRef = useRef<SlideLayout[] | null>(null);
  const nodesCacheRef = useRef<NodesCache | null>(null);

  const { toggle: toggleFullscreen, fullscreen } = useFullscreenDocument();
  const canFullscreen = document.fullscreenEnabled;
  const [laserPointerEnabled, setLaserPointerEnabled] = useState(false);

  useEffect(
    () => () => {
      // closing the presentation must not leave the page in fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => undefined);
      }
    },
    [],
  );

  const handleToggleFullscreen = () => {
    toggleFullscreen().catch(() => undefined);
  };

  const slideCount = (deck.slides?.length ?? 0) + 1;
  const contentSlide =
    deck.index > 0 ? deck.slides?.[deck.index - 1] : undefined;
  const slideKey = contentSlide ? contentSlide.nodeIndexes.join("-") : "title";

  const slideDoc = useMemo<JSONContent | null>(
    () =>
      contentSlide
        ? {
            type: "doc",
            content: contentSlide.nodeIndexes.map((index) => deck.nodes[index]),
          }
        : null,
    [contentSlide, deck.nodes],
  );

  const paginate = useCallback((editor: Editor) => {
    const area = measurementAreaRef.current;
    if (!area || editor.isDestroyed) return;

    const slides = paginateBlocks(
      measureBlocks(editor),
      getContentBoxHeight(area),
    );
    if (sameSlideLayouts(lastLayoutRef.current, slides)) return;
    lastLayoutRef.current = slides;

    const doc = editor.state.doc;
    if (nodesCacheRef.current?.doc !== doc) {
      nodesCacheRef.current = { doc, nodes: doc.toJSON().content ?? [] };
    }
    const { nodes } = nodesCacheRef.current;
    setDeck((current) => {
      const anchor = current.slides?.[current.index - 1]?.nodeIndexes[0];
      const index =
        anchor === undefined ? 0 : findSlideIndexForNode(slides, anchor) + 1;
      return { slides, nodes, index };
    });
  }, []);

  const showSlide = (pick: (index: number, lastIndex: number) => number) => {
    setDeck((current) => {
      const lastIndex = current.slides?.length ?? 0;
      const index = Math.min(
        Math.max(pick(current.index, lastIndex), 0),
        lastIndex,
      );
      return index === current.index ? current : { ...current, index };
    });
  };

  const goToNext = () => showSlide((index) => index + 1);
  const goToPrevious = () => showSlide((index) => index - 1);

  const scrollSlide = (direction: 1 | -1, page: boolean) => {
    const area = slideAreaRef.current;
    if (!area) return false;

    const previousTop = area.scrollTop;
    // scrollBy is instant here, so scrollTop has already moved when it returns
    area.scrollBy({ top: direction * area.clientHeight * (page ? 0.9 : 0.15) });
    return area.scrollTop !== previousTop;
  };

  useWindowEvent("keydown", (event) => {
    const action = getDeckKeyAction(event, stageRef.current);
    if (!action) return;
    event.preventDefault();

    switch (action) {
      case "next":
        goToNext();
        break;
      case "previous":
        goToPrevious();
        break;
      case "first":
        showSlide(() => 0);
        break;
      case "last":
        showSlide((_, lastIndex) => lastIndex);
        break;
      case "lineDown":
        if (!scrollSlide(1, false)) goToNext();
        break;
      case "lineUp":
        if (!scrollSlide(-1, false)) goToPrevious();
        break;
      case "pageDown":
        if (!scrollSlide(1, true)) goToNext();
        break;
      case "pageUp":
        if (!scrollSlide(-1, true)) goToPrevious();
        break;
    }
  });

  useLayoutEffect(() => {
    const area = slideAreaRef.current;
    area?.scrollTo({ top: 0 });

    const active = document.activeElement;
    if (
      !active ||
      active === document.body ||
      (active as HTMLButtonElement).disabled
    ) {
      area?.focus({ preventScroll: true });
    }
  }, [slideKey]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // comment marks dispatch this to open the page's comment panel behind the modal
    const stopCommentActivation = (event: Event) => event.stopPropagation();
    stage.addEventListener("ACTIVE_COMMENT_EVENT", stopCommentActivation);
    return () =>
      stage.removeEventListener("ACTIVE_COMMENT_EVENT", stopCommentActivation);
  }, []);

  const returnFocusAfterClick = (event: ReactMouseEvent) => {
    const area = slideAreaRef.current;
    // detail is 0 when a key activated the control, which should keep focus
    if (!area || event.detail === 0) return;
    if (shouldReturnFocusToSlide(document.activeElement, area)) {
      area.focus({ preventScroll: true });
    }
  };

  const handleSlideMouseOut = (event: ReactMouseEvent) => {
    // keys typed while an embed's iframe has focus never reach the deck
    if (
      event.target instanceof HTMLIFrameElement &&
      document.activeElement === event.target
    ) {
      slideAreaRef.current?.focus({ preventScroll: true });
    }
  };

  return (
    <TransclusionLookupProvider>
      <Tooltip label={t("Exit presentation mode")} openDelay={250}>
        <ActionIcon
          className={classes.closeButton}
          variant="subtle"
          color="gray"
          size="lg"
          aria-label={t("Exit presentation mode")}
          onClick={onClose}
        >
          <IconX size={22} />
        </ActionIcon>
      </Tooltip>

      <div ref={stageRef} className={classes.stage}>
        <div
          ref={measurementAreaRef}
          className={classes.measurementArea}
          aria-hidden="true"
        >
          <EditorProvider
            editorContainerProps={{ className: classes.editorContainer }}
            editable={false}
            immediatelyRender={true}
            textDirection="auto"
            extensions={presentationExtensions}
            content={content}
            onBeforeCreate={({ editor }) => setEditorPageId(editor, pageId)}
          >
            <MeasurementObserver
              areaRef={measurementAreaRef}
              onMeasure={paginate}
            />
          </EditorProvider>
        </div>

        <Box
          ref={slideAreaRef}
          className={clsx(
            classes.slideArea,
            contentSlide?.scrollable && classes.scrollable,
          )}
          tabIndex={-1}
          data-autofocus
          onClick={returnFocusAfterClick}
          onMouseOut={handleSlideMouseOut}
        >
          {slideDoc ? (
            <EditorProvider
              key={slideKey}
              editorContainerProps={{ className: classes.editorContainer }}
              editable={false}
              immediatelyRender={true}
              textDirection="auto"
              extensions={presentationExtensions}
              content={slideDoc}
              editorProps={{
                attributes: {
                  role: "document",
                  "aria-label": t("Page content"),
                },
              }}
              onBeforeCreate={({ editor }) => setEditorPageId(editor, pageId)}
            />
          ) : (
            <div className={classes.titleSlide}>
              <Title order={1} className={classes.titleSlideText} dir="auto">
                {title || t("Untitled")}
              </Title>
            </div>
          )}
        </Box>
      </div>

      <div className={classes.controls}>
        <div className={classes.controlBar}>
          <ActionIcon
            className={classes.controlButton}
            variant="subtle"
            color="dark"
            size="lg"
            radius="xl"
            aria-label={t("Previous slide")}
            disabled={deck.index === 0}
            onClick={goToPrevious}
          >
            <IconChevronLeft size={20} />
          </ActionIcon>

          <span
            className={classes.slideCounter}
            style={
              {
                "--total-digits": String(slideCount).length,
              } as CSSProperties
            }
            aria-hidden="true"
          >
            <span>{deck.index + 1}</span>
            <span className={classes.slideTotal}> / {slideCount}</span>
          </span>

          <ActionIcon
            className={classes.controlButton}
            variant="subtle"
            color="dark"
            size="lg"
            radius="xl"
            aria-label={t("Next slide")}
            disabled={deck.index === slideCount - 1}
            onClick={goToNext}
          >
            <IconChevronRight size={20} />
          </ActionIcon>

          <Divider
            orientation="vertical"
            aria-orientation="vertical"
            className={classes.controlDivider}
          />

          <Tooltip label={t("Laser pointer")} openDelay={250}>
            <ActionIcon
              className={classes.controlButton}
              variant="subtle"
              color={laserPointerEnabled ? "blue" : "dark"}
              size="lg"
              radius="xl"
              aria-label={t("Laser pointer")}
              aria-pressed={laserPointerEnabled}
              onClick={() => setLaserPointerEnabled((enabled) => !enabled)}
            >
              <IconPointer size={20} />
            </ActionIcon>
          </Tooltip>

          {canFullscreen && (
            <Tooltip
              label={fullscreen ? t("Exit fullscreen") : t("Enter fullscreen")}
              openDelay={250}
            >
              <ActionIcon
                className={classes.controlButton}
                variant="subtle"
                color="dark"
                size="lg"
                radius="xl"
                aria-label={
                  fullscreen ? t("Exit fullscreen") : t("Enter fullscreen")
                }
                onClick={handleToggleFullscreen}
              >
                {fullscreen ? (
                  <IconMinimize size={20} />
                ) : (
                  <IconMaximize size={20} />
                )}
              </ActionIcon>
            </Tooltip>
          )}
        </div>

        <VisuallyHidden role="status">
          {t("Slide {{current}} of {{total}}", {
            current: deck.index + 1,
            total: slideCount,
          })}
        </VisuallyHidden>
      </div>

      <LaserPointer enabled={laserPointerEnabled} />
    </TransclusionLookupProvider>
  );
}

function MeasurementObserver({
  areaRef,
  onMeasure,
}: {
  areaRef: RefObject<HTMLDivElement | null>;
  onMeasure: (editor: Editor) => void;
}) {
  const { editor } = useCurrentEditor();

  useEffect(() => {
    const area = areaRef.current;
    if (!editor || !area) return;

    const observer = new ResizeObserver(() => onMeasure(editor));
    observer.observe(area);
    observer.observe(editor.view.dom);
    return () => observer.disconnect();
  }, [editor, areaRef, onMeasure]);

  return null;
}
