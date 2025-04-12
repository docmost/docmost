import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useShareQuery } from "@/features/share/queries/share-query.ts";
import { Affix, Button, Container } from "@mantine/core";
import React from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";

export default function SingleSharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();

  const {
    data: page,
    isLoading,
    isError,
    error,
  } = useShareQuery({ pageId: extractPageSlugId(pageSlug) });

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
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

      <Affix position={{ bottom: 20, right: 20 }}>
        <Button variant="default">Powered by Docmost</Button>
      </Affix>
    </div>
  );
}
