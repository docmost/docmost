import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useShareQuery } from "@/features/share/queries/share-query.ts";
import { Container } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";

export default function SingleSharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { shareId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useShareQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  useEffect(() => {
    if (shareId && data) {
      if (data.share.key !== shareId) {
        // affects parent share, what to do?
        //navigate(`/share/${data.share.key}/${pageSlug}`);
      }
    }
  }, [shareId, data]);

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    <div>
      <Helmet>
        <title>{`${data?.page?.icon || ""}  ${data?.page?.title || t("untitled")}`}</title>
      </Helmet>

      <Container size={900}>
        <ReadonlyPageEditor
          key={data.page.id}
          title={data.page.title}
          content={data.page.content}
        />
      </Container>
    </div>
  );
}
