import type { Editor } from "@tiptap/react";
import type { Node as PMNode } from "@tiptap/pm/model";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import type { LightboxRequest } from "@/features/editor/atoms/editor-atoms";
import { getFileUrl } from "@/lib/config.ts";
import "yet-another-react-lightbox/styles.css";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { useEffect, useMemo, useState } from "react";
import i18n from "@/i18n.ts";
import { useTranslation } from "react-i18next";

type LightboxViewProps = {
  editor: Editor;
  open: boolean;
  src: string;
  type: "image" | "video";
  onClose: () => void;
};

function getVideoMimeType(src: string) {
  const extension = src.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase();

  switch (extension) {
    case "webm":
      return "video/webm";
    case "ogv":
      return "video/ogg";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/x-m4v";
    default:
      return "video/mp4";
  }
}

function getFilename(src: string) {
  const filename = src.split(/[?#]/, 1)[0].split("/").pop();
  if (!filename) return i18n.t("Media");

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

function getMedia(rawSrc: string, type?: string, alt?: string): Slide {
  const src = getFileUrl(rawSrc);
  const filename = getFilename(rawSrc);

  if (type === "video") {
    return {
      type: "video",
      sources: [{ src, type: getVideoMimeType(rawSrc) }],
      download: { url: src, filename },
    };
  } else {
    return {
      type: "image",
      src,
      alt: alt || undefined,
      download: { url: src, filename },
    };
  }
}

const LIGHTBOX_NODE_TYPES: Record<string, "image" | "video"> = {
  image: "image",
  video: "video",
  drawio: "image",
  excalidraw: "image",
};

// video is excluded: clicks there operate the native controls
const CLICK_TO_EXPAND_NODE_TYPES = new Set(["image", "drawio", "excalidraw"]);

export function getLightboxClickRequest(node: PMNode): LightboxRequest {
  if (!CLICK_TO_EXPAND_NODE_TYPES.has(node.type.name)) return null;

  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  if (!src) return null;

  return { src: getFileUrl(src), type: "image" };
}

function getPageMedia(editor: Editor): Slide[] {
  const media: Slide[] = [];

  editor.state.doc.descendants((node) => {
    const type = LIGHTBOX_NODE_TYPES[node.type.name];
    if (!type) return;

    const rawSrc = typeof node.attrs.src === "string" ? node.attrs.src : "";
    if (!rawSrc) return;

    media.push(getMedia(rawSrc, type, node.attrs.alt));
  });

  return media;
}

export default function LightboxView({
  editor,
  open,
  src,
  type,
  onClose,
}: LightboxViewProps) {
  const { i18n: i18nInstance } = useTranslation();

  const selectedSlide = useMemo(
    () => getMedia(src, type),
    [src, type, i18nInstance.language]
  );

  const [pageSlides, setPageSlides] = useState<Slide[]>([]);
  const [loadedMediaKey, setLoadedMediaKey] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!open) setIsFullscreen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setLoadedMediaKey(null);

    const frame = requestAnimationFrame(() => {
      const slides = getPageMedia(editor);

      setPageSlides(slides);
      setLoadedMediaKey(`${type}:${src}`);
    });

    return () => cancelAnimationFrame(frame);
  }, [editor, open, type, src]);

  const slides = loadedMediaKey === `${type}:${src}` ? pageSlides : [selectedSlide];

  const index = useMemo(() => {
    if (!(pageSlides.length > 0)) {
      return 0;
    }

    const idx = slides.findIndex((slide) =>
      type === "video"
        ? "sources" in slide && slide.sources.some((s) => s.src === src)
        : "src" in slide && slide.src === src
    );
    return idx >= 0 ? idx : 0;
  }, [slides, src, type]);

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Download, Fullscreen, Video, Zoom]}
      styles={{
        container: { backgroundColor: "rgba(0, 0, 0, 0.8)" },
        icon: { width: 24, height: 24 },
        toolbar: {
          margin: 8,
          borderRadius: 8,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        },
      }}
      controller={{ closeOnBackdropClick: !isFullscreen }}
      on={{
        enterFullscreen: () => setIsFullscreen(true),
        exitFullscreen: () => setIsFullscreen(false),
      }}
      video={{ controls: true, playsInline: true }}
      zoom={{
        scrollToZoom: true,
        maxZoomPixelRatio: 4,
        maxZoom: 4,
        supports: ["video"],
      }}
    />
  );
}
