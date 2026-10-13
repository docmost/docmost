import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconPencil } from "@tabler/icons-react";
import { useAuthenticatedUser } from "@/features/public-space/hooks/use-authenticated-user.ts";
import { useDocsCurrentPage } from "@/features/public-space/hooks/use-docs-current-page.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import styles from "./docs.module.css";

export default function DocsEditPage() {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const page = useDocsCurrentPage();

  const { data: currentUser } = useAuthenticatedUser();

  if (!currentUser?.user || !page) {
    return null;
  }

  return (
    <Link
      className={styles.editPageLink}
      to={buildPageUrl(spaceSlug, page.slugId, page.name)}
      target="_blank"
      rel="noopener"
    >
      <IconPencil size={14} stroke={1.8} aria-hidden />
      {t("Edit page")}
    </Link>
  );
}
