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
import React from "react";
import FolderView from "./folder-view";

const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedPageHeader = React.memo(PageHeader);
const MemoizedHistoryModal = React.memo(HistoryModal);

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();

  const {
    data: page,
    isLoading,
    isError,
    error,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const spaceRules = space?.membership?.permissions;
  const spaceAbility = useSpaceAbility(spaceRules);

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

  const canManagePage = spaceAbility.can(
    SpaceCaslAction.Manage,
    SpaceCaslSubject.Page,
  );
  const isFolder = page.nodeType === "folder";

  return (
    page && (
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${page?.title || t("untitled")}`}</title>
        </Helmet>

        <MemoizedPageHeader
          readOnly={!canManagePage}
        />

        {isFolder ? (
          <FolderView
            folderPage={page}
            readOnly={!canManagePage}
            spaceSlug={page?.space?.slug}
          />
        ) : (
          <MemoizedFullEditor
            key={page.id}
            pageId={page.id}
            title={page.title}
            content={page.content}
            slugId={page.slugId}
            spaceSlug={page?.space?.slug}
            editable={canManagePage}
          />
        )}
        <MemoizedHistoryModal pageId={page.id} />
      </div>
    )
  );
}
