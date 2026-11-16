import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetAtom } from "jotai";
import type { QueryObserverResult } from "@tanstack/react-query";
import { reviewChangesAtom } from "@/ee/page-verification/atoms/review-changes-atom";
import { getReviewLinkTarget } from "@/ee/page-verification/page-verification.utils";
import { IPageVerificationInfo } from "@/ee/page-verification/types/page-verification.types";

const REVIEW_PARAM = "review";
const REVIEW_CHANGES_VALUE = "changes";

type UseReviewChangesDeepLinkOptions = {
  // undefined until the page loads, and always without the verification feature
  pageId: string | undefined;
  refetchInfo: () => Promise<
    QueryObserverResult<IPageVerificationInfo, Error>
  >;
  onOpenVerification: () => void;
};

// opens the review dialog, or else the verification modal, for a ?review=changes link
export function useReviewChangesDeepLink({
  pageId,
  refetchInfo,
  onOpenVerification,
}: UseReviewChangesDeepLinkOptions) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(REVIEW_PARAM) === REVIEW_CHANGES_VALUE;
  const setReviewChanges = useSetAtom(reviewChangesAtom);
  const handledRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!requested) {
      handledRef.current = null;
      return;
    }
    if (!pageId || handledRef.current === pageId) return;
    handledRef.current = pageId;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete(REVIEW_PARAM);
    setSearchParams(nextParams, { replace: true });

    // cached status can predate the change the link reports
    void refetchInfo().then(({ data, isError }) => {
      if (!mountedRef.current || isError) return;
      const target = getReviewLinkTarget(data);
      if (target === "review") {
        setReviewChanges({ pageId, source: "link" });
      } else if (target === "verification") {
        onOpenVerification();
      }
    });
  }, [
    requested,
    pageId,
    searchParams,
    setSearchParams,
    refetchInfo,
    setReviewChanges,
    onOpenVerification,
  ]);
}
