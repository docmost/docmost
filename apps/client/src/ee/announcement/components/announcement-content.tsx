import { Fragment, type ReactNode } from "react";
import { VisuallyHidden } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { isSafeAnnouncementHref } from "@/ee/announcement/announcement.utils";
import type { IAnnouncementContent } from "@/ee/announcement/types/announcement.types";

type AnnouncementContentProps = {
  content: IAnnouncementContent;
};

export function AnnouncementContent({ content }: AnnouncementContentProps) {
  const { t } = useTranslation();
  const nodes = content.content.flatMap((paragraph) => paragraph.content ?? []);

  return (
    <>
      {nodes.map((node, index) => {
        let element: ReactNode = <span>{node.text}</span>;
        let href: string | null = null;

        for (const mark of node.marks ?? []) {
          if (mark.type === "bold") element = <strong>{element}</strong>;
          if (mark.type === "italic") element = <em>{element}</em>;
          if (mark.type === "underline") element = <u>{element}</u>;
          if (mark.type === "link") href = mark.attrs.href;
        }

        if (href !== null && isSafeAnnouncementHref(href)) {
          const target = href.trim();
          if (!target.startsWith("/")) {
            element = (
              <a
                href={target}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {element}
                <VisuallyHidden> {t("(opens in a new tab)")}</VisuallyHidden>
              </a>
            );
          } else if (target.startsWith("/api/")) {
            // Server routes such as file downloads would hit the client router's 404 page
            element = <a href={target}>{element}</a>;
          } else {
            element = <Link to={target}>{element}</Link>;
          }
        }

        return <Fragment key={index}>{element}</Fragment>;
      })}
    </>
  );
}
