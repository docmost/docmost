import "@/features/editor/styles/index.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionIcon, Box, Modal, Text, Title, Tooltip } from "@mantine/core";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useHotkeys } from "@mantine/hooks";
import { EditorProvider, type JSONContent } from "@tiptap/react";
import { useTranslation } from "react-i18next";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import classes from "./presentation-modal.module.css";

type PresentationSlide =
  | { kind: "title" }
  | { kind: "content"; doc: JSONContent; scrollable: boolean };

type MeasuredContentSlide = {
  doc: JSONContent;
  scrollable: boolean;
};

interface PresentationModalProps {
  title: string;
  content: JSONContent;
  opened: boolean;
  onClose: () => void;
}

const excludedExtensionNames = new Set([
  "uniqueID",
  "tableHeaderPin",
  "tableReadonlySort",
]);

export default function PresentationModal({
  title,
  content,
  opened,
  onClose,
}: PresentationModalProps) {
  const { t } = useTranslation();
  const [slideIndex, setSlideIndex] = useState(0);
  const [contentSlides, setContentSlides] = useState<MeasuredContentSlide[] | null>(
    null
  );
  const slideAreaRef = useRef<HTMLDivElement>(null);

  const extensions = useMemo(
    () => mainExtensions.filter((ext) => !excludedExtensionNames.has(ext.name)),
    []
  );

  useEffect(() => {
    if (opened) {
      setSlideIndex(0);
      setContentSlides(null);
    }
  }, [opened, content]);

  useEffect(() => {
    if (!opened || !slideAreaRef.current) return;

    const slideArea = slideAreaRef.current;
    let previousWidth = slideArea.clientWidth;
    let previousHeight = slideArea.clientHeight;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;

      if (width === previousWidth && height === previousHeight) {
        return;
      }

      previousWidth = width;
      previousHeight = height;

      setSlideIndex(0);
      setContentSlides(null);
    });

    observer.observe(slideArea);

    return () => observer.disconnect();
  }, [opened]);

  const slides: PresentationSlide[] = useMemo(
    () => [
      { kind: "title" as const },
      ...(contentSlides ?? []).map(({ doc, scrollable }) => ({
        kind: "content" as const,
        doc,
        scrollable,
      })),
    ],
    [contentSlides]
  );

  const paginateContent = useCallback(
    (editor: { view: { dom: HTMLElement } }) => {
      const nodes = content.content ?? [];
      const area = slideAreaRef.current;
      if (!nodes.length || !area) {
        setContentSlides([]);
        return;
      }

      const editorElement = editor.view.dom;
      const renderedNodes = Array.from(editorElement.children) as HTMLElement[];

      const areaStyles = window.getComputedStyle(area);
      const availableHeight =
        area.clientHeight -
        parseFloat(areaStyles.paddingTop) -
        parseFloat(areaStyles.paddingBottom);
      const slides: MeasuredContentSlide[] = [];
      let currentSlide: JSONContent[] = [];
      let currentSlideTop = renderedNodes[0].getBoundingClientRect().top;
      let currentSlideBottom = currentSlideTop;

      const saveCurrentSlide = () => {
        if (currentSlide.length === 0) return;

        slides.push({
          doc: { type: "doc", content: currentSlide },
          scrollable: currentSlideBottom - currentSlideTop > availableHeight,
        });
      };

      renderedNodes.forEach((renderedNode, index) => {
        const node = nodes[index];
        const nodeRect = renderedNode.getBoundingClientRect();
        const startsNewSection =
          node.type === "horizontalRule" ||
          (node.type === "heading" && node.attrs?.level === 1);
        const exceedsPage =
          currentSlide.length > 0 &&
          nodeRect.bottom - currentSlideTop > availableHeight;

        if (currentSlide.length > 0 && (startsNewSection || exceedsPage)) {
          saveCurrentSlide();
          currentSlide = [];
          currentSlideTop = nodeRect.top;
        }

        currentSlide.push(node);
        currentSlideBottom = nodeRect.bottom;
      });

      saveCurrentSlide();
      setContentSlides(slides);
    },
    [content]
  );

  const goToNext = useCallback(() => {
    setSlideIndex((index) => Math.min(index + 1, slides.length - 1));
  }, [slides.length]);

  const goToPrevious = useCallback(() => {
    setSlideIndex((index) => Math.max(index - 1, 0));
  }, []);

  const goToFirst = useCallback(() => {
    setSlideIndex(0);
  }, []);

  const goToLast = useCallback(() => {
    setSlideIndex(slides.length - 1);
  }, [slides.length]);

  useHotkeys([
    ["ArrowRight", goToNext, { preventDefault: true }],
    ["ArrowDown", goToNext, { preventDefault: true }],
    ["PageDown", goToNext, { preventDefault: true }],
    ["space", goToNext, { preventDefault: true }],
    ["ArrowLeft", goToPrevious, { preventDefault: true }],
    ["ArrowUp", goToPrevious, { preventDefault: true }],
    ["PageUp", goToPrevious, { preventDefault: true }],
    ["Home", goToFirst, { preventDefault: true }],
    ["End", goToLast, { preventDefault: true }],
  ]);

  const currentSlide = slides[slideIndex];

  return (
    <Modal.Root
      opened={opened}
      onClose={onClose}
      fullScreen
      closeOnEscape
      transitionProps={{ duration: 150 }}
    >
      <Modal.Overlay />
      <Modal.Content className={classes.content}>
        <Modal.Body className={classes.body}>
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

          <Box
            className={`${classes.slideArea} ${
              currentSlide?.kind === "content" && currentSlide.scrollable
                ? classes.scrollable
                : ""
            }`}
            ref={slideAreaRef}
          >
            {opened && contentSlides === null && (
              <div className={classes.measurementArea} aria-hidden="true">
                <TransclusionLookupProvider>
                  <EditorProvider
                    editable={false}
                    immediatelyRender={true}
                    textDirection="auto"
                    extensions={extensions}
                    content={content}
                    onCreate={({ editor }) => {
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => paginateContent(editor));
                      });
                    }}
                  ></EditorProvider>
                </TransclusionLookupProvider>
              </div>
            )}

            {currentSlide?.kind === "title" ? (
              <div className={classes.titleSlide}>
                <Title order={1} className={classes.titleSlideText}>
                  {title || t("Untitled")}
                </Title>
              </div>
            ) : (
              currentSlide && (
                <TransclusionLookupProvider>
                  <EditorProvider
                    key={slideIndex}
                    editable={false}
                    immediatelyRender={true}
                    textDirection="auto"
                    extensions={extensions}
                    content={currentSlide.doc}
                  ></EditorProvider>
                </TransclusionLookupProvider>
              )
            )}
          </Box>

          <div className={classes.controls}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={t("Previous slide")}
              disabled={slideIndex === 0}
              onClick={goToPrevious}
            >
              <IconChevronLeft size={22} />
            </ActionIcon>

            <Text size="sm" c="dimmed" className={classes.slideCounter}>
              {t("Slide {{current}} of {{total}}", {
                current: slideIndex + 1,
                total: slides.length,
              })}
            </Text>

            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={t("Next slide")}
              disabled={slideIndex === slides.length - 1}
              onClick={goToNext}
            >
              <IconChevronRight size={22} />
            </ActionIcon>
          </div>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
