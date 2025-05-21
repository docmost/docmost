import { useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import { Error404 } from "@/components/ui/error-404.tsx";
import { useGetShareByIdQuery } from "@/features/share/queries/share-query.ts";

export default function ShareRedirect() {
  const { shareId } = useParams();
  const navigate = useNavigate();

  const { data: share, isLoading, isError } = useGetShareByIdQuery(shareId);

  useEffect(() => {
    if (share) {
      navigate(
        buildSharedPageUrl({
          shareId: share.key,
          pageSlugId: share?.sharedPage.slugId,
          pageTitle: share?.sharedPage.title,
        }),
        { replace: true },
      );
    }
  }, [isLoading, share]);

  if (isError) {
    return <Error404 />;
  }

  if (isLoading) {
    return <></>;
  }

  return null;
}
