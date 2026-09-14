import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { useDocsSurface } from "@/features/public-space/components/docs/docs-surface-context.tsx";
import { flattenTreePreorder } from "@/features/public-space/utils/docs-tree.ts";
import { extractPageSlugId } from "@/lib";
import { SharedPageTreeNode } from "@/features/share/utils.ts";
import styles from "./docs.module.css";

export default function DocsPageNav() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { treeData, getNodeUrl } = useDocsSurface();

  const { prev, next } = useMemo(() => {
    if (!treeData?.length) {
      return {
        prev: null as SharedPageTreeNode | null,
        next: null as SharedPageTreeNode | null,
      };
    }
    const flat = flattenTreePreorder(treeData);
    const currentSlugId = pageSlug
      ? extractPageSlugId(pageSlug)
      : treeData[0]?.slugId;
    const index = flat.findIndex((node) => node.slugId === currentSlugId);
    return {
      prev: index > 0 ? flat[index - 1] : null,
      next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
    };
  }, [treeData, pageSlug]);

  if (!prev && !next) return null;

  return (
    <nav className={styles.pageNav} aria-label={t("Page navigation")}>
      {prev && (
        <Link
          to={getNodeUrl(prev)}
          className={styles.pageNavCard}
          data-direction="prev"
        >
          <span className={styles.pageNavLabel}>
            <IconArrowLeft size={13} stroke={2} aria-hidden />
            {t("Previous")}
          </span>
          <span className={styles.pageNavTitle}>
            {prev.name || t("untitled")}
          </span>
        </Link>
      )}
      {next && (
        <Link
          to={getNodeUrl(next)}
          className={styles.pageNavCard}
          data-direction="next"
        >
          <span className={styles.pageNavLabel}>
            {t("Next")}
            <IconArrowRight size={13} stroke={2} aria-hidden />
          </span>
          <span className={styles.pageNavTitle}>
            {next.name || t("untitled")}
          </span>
        </Link>
      )}
    </nav>
  );
}
