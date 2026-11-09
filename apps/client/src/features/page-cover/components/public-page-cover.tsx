import { useState } from "react";
import clsx from "clsx";
import classes from "./page-cover.module.css";
import { CoverImage } from "@/features/page-cover/components/cover-image.tsx";
import { CoverCredit } from "@/features/page-cover/components/cover-credit.tsx";
import {
  getCoverCredit,
  getCoverPosition,
  resolveCover,
} from "@/features/page-cover/page-cover.utils.ts";

type PublicPageCoverProps = {
  coverPhoto: string | null;
  coverPosition?: number | null;
  coverAttribution?: unknown;
  variant?: "inline" | "band";
};

export function PublicPageCover({
  coverPhoto,
  coverPosition,
  coverAttribution,
  variant = "inline",
}: PublicPageCoverProps) {
  const cover = resolveCover(coverPhoto);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!cover) return null;
  if (cover.kind === "image" && failedSrc === cover.src) return null;

  // credit outside the picker is off for now
  const credit: ReturnType<typeof getCoverCredit> = null;
  // const credit = getCoverCredit(coverPhoto, coverAttribution);

  return (
    <div
      className={clsx(
        variant === "band" ? classes.band : classes.inlineCover,
        "print-hide",
      )}
    >
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
      {credit && (
        <CoverCredit attribution={credit} className={classes.inlineCredit} />
      )}
    </div>
  );
}
