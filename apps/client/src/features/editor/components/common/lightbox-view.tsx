import type { Editor } from "@tiptap/react";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import { getFileUrl } from "@/lib/config.ts";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { useMemo } from "react";
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
  const caption = alt || filename;

  if (type === "video") {
    return {
      type: "video",
      sources: [{ src, type: getVideoMimeType(rawSrc) }],
      title: caption,
      download: { url: src, filename },
    };
  } else {
    return {
      type: "image",
      src,
      alt: alt || undefined,
      title: caption,
      download: { url: src, filename },
    };
  }
}

function getPageMedia(editor: Editor): Slide[] {
  const media: Slide[] = [];

  editor.state.doc.descendants((node) => {
    if (node.type.name !== "image" && node.type.name !== "video") return;

    const rawSrc = typeof node.attrs.src === "string" ? node.attrs.src : "";
    if (!rawSrc) return;

    media.push(getMedia(rawSrc, node.type.name, node.attrs.alt));
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

  const slides = useMemo(
    () => getPageMedia(editor),
    [editor, open, i18nInstance.language]
  );

  const index = useMemo(() => {
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
      index={index >= 0 ? index : 0}
      slides={slides}
      plugins={[Captions, Download, Fullscreen, Video, Zoom]}
      captions={{ descriptionTextAlign: "center" }}
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
