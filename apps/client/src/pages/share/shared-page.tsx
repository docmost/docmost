import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useShareQuery } from "@/features/share/queries/share-query.ts";
import { Container } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { buildPageSlug } from "@/features/page/page.utils.ts";

export default function SharedPage() {
  const { t } = useTranslation();
  const { shareId } = useParams();
  const {
    data: page,
    isLoading,
    isError,
    error,
  } = useShareQuery({ shareId: shareId });
  const navigate = useNavigate();

  useEffect(() => {
    if (!page) return;
    const pageSlug = buildPageSlug(page.slugId, page.title);
    const shareSlug = `/share/${shareId}/${pageSlug}`;
    navigate(shareSlug, { replace: true });
  }, [page]);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <div>{t("Page not found")}</div>;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <Container size={900} pt={50}>
          <ReadonlyPageEditor
            key={page.id}
            title={page.title}
            content={page.content}
          />
        </Container>
      </div>
    )
  );
}
