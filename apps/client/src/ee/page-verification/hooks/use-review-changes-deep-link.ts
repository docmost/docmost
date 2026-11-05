import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import { reviewChangesAtom } from "@/ee/page-verification/atoms/review-changes-atom";
import { canReviewChanges } from "@/ee/page-verification/page-verification.utils";
import { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";

const REVIEW_PARAM = "review";
const REVIEW_CHANGES_VALUE = "changes";

type UseReviewChangesDeepLinkOptions = {
  pageId: string | undefined;
  info: IPageVerificationInfo | undefined;
  isLoading: boolean;
  onOpenVerification: () => void;
};

// opens the review dialog, or else the verification modal, for a ?review=changes link
export function useReviewChangesDeepLink({
  pageId,
  info,
  isLoading,
  onOpenVerification,
}: UseReviewChangesDeepLinkOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(REVIEW_PARAM) === REVIEW_CHANGES_VALUE;
  const setReviewChanges = useSetAtom(reviewChangesAtom);
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!requested) {
      handledRef.current = null;
      return;
    }
    // info stays undefined without the verification feature
    if (!pageId || isLoading || !info) return;
    if (handledRef.current === pageId) return;
    handledRef.current = pageId;

    if (canReviewChanges(info)) {
      setReviewChanges({ pageId, source: "link" });
    } else if (info.status !== "none") {
      onOpenVerification();
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(REVIEW_PARAM);
    setSearchParams(nextParams, { replace: true });
  }, [
    requested,
    pageId,
    isLoading,
    info,
    searchParams,
    setSearchParams,
    setReviewChanges,
    onOpenVerification,
  ]);
}
