import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  useSharePageQuery
} from "@/features/share/queries/share-query.ts";
import { Container } from "@mantine/core";
import React, { useEffect, useState } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import ShareBranding from "@/features/share/components/share-branding.tsx";
import SharePasswordModal from "@/features/share/components/share-password-modal.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { useAnchorScroll } from "@/features/editor/components/heading/use-anchor-scroll";
import { useAtom } from "jotai";
import { shareFullPageWidthAtom } from "@/features/share/atoms/sidebar-atom";

export default function SharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { shareId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  useAnchorScroll();

  const [isFullWidth] = useAtom(shareFullPageWidthAtom);

  const sessionPassword = shareId ? sessionStorage.getItem(`share-password-${shareId}`) : null;

  const { data, isLoading, isError, error } = useSharePageQuery({
    pageId: extractPageSlugId(pageSlug),
    password: sessionPassword || undefined,
  });

  useEffect(() => {
    if (shareId && data) {
      if (data.share.key !== shareId) {
        navigate(`/share/${data.share.key}/p/${pageSlug}`, { replace: true });
      }
    }
  }, [shareId, data]);

  useEffect(() => {
    if (isError && error) {
      if (error?.["status"] === 403 && error?.["response"]?.data?.error === "SHARE_PASSWORD_REQUIRED") {
        setIsPasswordModalOpen(true);
      }
    }
  }, [isError, error]);

  const handlePasswordSuccess = (enteredPassword: string) => {
    if (shareId) {
      sessionStorage.setItem(`share-password-${shareId}`, enteredPassword);
    }
    setIsPasswordModalOpen(false);

    queryClient.invalidateQueries({
      queryKey: ["shares", {
        pageId: extractPageSlugId(pageSlug),
        password: enteredPassword,
      }],
    });
  };

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) {
    if ([401, 403, 404].includes(error?.["status"])) {
      if (error?.["status"] === 403 && error?.["response"]?.data?.error === "SHARE_PASSWORD_REQUIRED") {
        return (
          <SharePasswordModal
            shareId={shareId || ""}
            opened={isPasswordModalOpen}
            onSuccess={handlePasswordSuccess}
          />
        );
      }
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  if (isPasswordModalOpen) {
    return (
      <SharePasswordModal
        shareId={shareId || ""}
        opened={isPasswordModalOpen}
        onSuccess={handlePasswordSuccess}
      />
    );
  }

  return (
    <div>
      <Helmet>
        <title>{`${data?.page?.title || t("untitled")}`}</title>
        {!data?.share.searchIndexing && (
          <meta name="robots" content="noindex" />
        )}
      </Helmet>

      <Container size={isFullWidth ? "100%" : 900} p={0}>
        <ReadonlyPageEditor
          key={data.page.id}
          title={data.page.title}
          content={data.page.content}
        />
      </Container>

      {data && !shareId && !data.hasLicenseKey && <ShareBranding />}
    </div>
  );
}
