import { useState } from "react";
import clsx from "clsx";
import classes from "./page-cover.module.css";
import { CoverImage } from "@/features/page-cover/components/cover-image.tsx";
import {
  getCoverPosition,
  resolveCover,
} from "@/features/page-cover/page-cover.utils.ts";

type PublicPageCoverProps = {
  coverPhoto: string | null;
  coverPosition?: number | null;
};

export function PublicPageCover({
  coverPhoto,
  coverPosition,
}: PublicPageCoverProps) {
  const cover = resolveCover(coverPhoto);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!cover) return null;
  if (cover.kind === "image" && failedSrc === cover.src) return null;

  return (
    <div className={clsx(classes.inlineCover, "print-hide")}>
      {cover.kind === "color" ? (
        <div className={classes.fill} style={{ backgroundColor: cover.color }} />
      ) : (
        <CoverImage
          key={cover.src}
          src={cover.src}
          position={getCoverPosition(coverPosition)}
          onError={() => setFailedSrc(cover.src)}
        />
      )}
    </div>
  );
}
