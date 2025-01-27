import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useSpaceAbility } from "@/features/space/permissions/use-space-ability.ts";
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from "@/features/space/permissions/permissions.type.ts";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { PageState } from "@/features/user/types/user.types";

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

  const [user] = useAtom(userAtom);
  const [pageState,setPageState] = useState(user.settings?.preferences?.pageState ? user.settings?.preferences?.pageState : PageState.Edit)
  const isEditorReadOnly = useMemo(() => {
    return pageState === PageState.Reading ? true : false;
  }, [pageState]);

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
          pageState={pageState}
          setPageState={setPageState}
          readOnly={spaceAbility.cannot(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          )}
        />

        <FullEditor
          key={page.id}
          pageId={page.id}
          title={page.title}
          content={page.content}
          slugId={page.slugId}
          spaceSlug={page?.space?.slug}
          editable={spaceAbility.can(
            SpaceCaslAction.Manage,
            SpaceCaslSubject.Page,
          ) && !isEditorReadOnly}
        />
        <HistoryModal pageId={page.id} />
      </div>
    )
  );
}
