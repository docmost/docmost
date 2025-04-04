import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { extractPageSlugId } from "@/lib";
import HistoryModal from "@/features/page-history/components/history-modal";
import { useSharedPageQuery } from "@/features/page/queries/shared-page-query";
import { useGetSharedSpaceBySlugQuery } from "@/features/space/queries/shared-space-query";
import { ReadonlyEditor } from "@/features/editor/readonly-editor";

export default function SharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const {
    data: page,
    isLoading,
    isError,
    error,
  } = useSharedPageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSharedSpaceBySlugQuery(page?.space?.slug);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <div>{t("Page not found")}</div>;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  if (!space) {
    return <></>;
  }

  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <ReadonlyEditor
          key={page.id}
          title={page.title}
          content={page.content}
        />
        <HistoryModal pageId={page.id} />
      </div>
    )
  );
}
