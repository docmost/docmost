import { useCallback, useEffect, useState } from "react";
import { unfurlUrl } from "@/features/integration/services/integration-service";
import { UnfurlNeedsConnection } from "@/features/integration/types/integration.types";

// Fetches the unfurl for a node still in "pending" and writes the result into
// its attrs. A needs-connection response stays local, never in the attrs: the
// doc keeps status "pending" so a viewer who IS connected still unfurls and
// materializes the card for everyone.
export function useUnfurl(
  url: string,
  status: string,
  updateAttributes: (attrs: Record<string, any>) => void,
) {
  const [needsConnection, setNeedsConnection] =
    useState<UnfurlNeedsConnection | null>(null);

  const doUnfurl = useCallback(async () => {
    if (status !== "pending" || !url) return;

    try {
      const result = await unfurlUrl({ url });
      if (result && "needsConnection" in result) {
        setNeedsConnection(result);
      } else if (result) {
        updateAttributes({
          unfurlData: result,
          status: "loaded",
        });
      } else {
        updateAttributes({ status: "error" });
      }
    } catch {
      updateAttributes({ status: "error" });
    }
  }, [url, status, updateAttributes]);

  useEffect(() => {
    if (status === "pending") {
      doUnfurl();
    }
  }, [status, doUnfurl]);

  return { needsConnection };
}
