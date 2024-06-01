import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";

export default function Page() {
  const { pageSlug, spaceSlug } = useParams();
  const {
    data: page,
    isLoading,
    isError,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    // TODO: fix this
    return <div>Error fetching page data.</div>;
  }

  return (
    page && (
      <div>
        <Helmet>
          <title>{page.title}</title>
        </Helmet>

        <PageHeader />

        <FullEditor
          pageId={page.id}
          title={page.title}
          slugId={page.slugId}
          spaceSlug={page?.space?.slug || spaceSlug}
        />
        <HistoryModal pageId={page.id} />
      </div>
    )
  );
}
