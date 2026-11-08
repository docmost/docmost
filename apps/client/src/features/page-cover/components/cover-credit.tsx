import { Trans } from "react-i18next";
import clsx from "clsx";
import classes from "./page-cover.module.css";
import { CoverAttribution } from "@/features/page-cover/page-cover.types.ts";
import { UNSPLASH_HOME_URL } from "@/features/page-cover/page-cover.constants.ts";
import { getUnsplashProfileUrl } from "@/features/page-cover/page-cover.utils.ts";

type CoverCreditProps = {
  attribution: CoverAttribution;
  className?: string;
};

export function CoverCredit({ attribution, className }: CoverCreditProps) {
  return (
    <div className={clsx(classes.credit, className)}>
      <Trans
        i18nKey="Photo by <author>{{name}}</author> on <unsplash>Unsplash</unsplash>"
        values={{ name: attribution.authorName }}
        components={{
          author: (
            <a
              href={getUnsplashProfileUrl(attribution.authorUsername)}
              target="_blank"
              rel="noopener noreferrer"
            />
          ),
          unsplash: (
            <a href={UNSPLASH_HOME_URL} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      />
    </div>
  );
}
