import { FullEditor } from "@/features/editor/full-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { usePageQuery } from "@/features/page/queries/page-query";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { extractPageSlugId } from "@/lib";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const {
    data: page,
    isLoading,
    isError,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    // TODO: fix this
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

        <PageHeader
          readOnly={spaceAbility.cannot(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />

        <FullEditor
          pageId={page.id}
          title={page.title}
          slugId={page.slugId}
          spaceSlug={page?.space?.slug}
          editable={spaceAbility.can(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />
        <HistoryModal pageId={page.id} />
      </div>
    )
  );
}
