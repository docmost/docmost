import { Container, Space } from "@mantine/core";
import HomeTabs from "@/features/home/components/home-tabs";
import SpaceGrid from "@/features/space/components/space-grid.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useEffect } from "react";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);
  const navigate = useNavigate();

  const landingPageId = workspace?.landingPageId ?? null;
  const { data: landingPage, isLoading: landingIsLoading } = usePageQuery(
    { pageId: landingPageId ?? undefined },
  );

  useEffect(() => {
    if (landingPage && landingPage.space?.slug) {
      navigate(
        buildPageUrl(landingPage.space.slug, landingPage.slugId, landingPage.title),
        { replace: true },
      );
    }
  }, [landingPage, navigate]);

  if (landingPageId && landingIsLoading) {
    return <></>;
  }

  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      <Container size={"800"} pt="xl">
        <SpaceGrid />

        <Space h="xl" />

        <HomeTabs />
      </Container>
    </>
  );
}
