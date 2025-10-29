
import { getAppUrl } from "@/lib/config";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

export const useEditorLink = () => {
  const { pageSlug } = useParams();

  const editorLink = useMemo(() => {
    return `${getAppUrl()}/s/general/p/${pageSlug}`;
  }, [pageSlug]);

  return editorLink;
};