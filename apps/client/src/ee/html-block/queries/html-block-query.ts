import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
  getHtmlBlock,
  getPublicSpaceHtmlBlock,
  getSharedHtmlBlock,
} from "@/ee/html-block/services/html-block-service";
import { useHtmlBlockScope } from "@/ee/html-block/html-block-scope";
import { HTML_BLOCKS_DISABLED_MESSAGE } from "@/ee/html-block/html-block.constants";
import { HtmlBlockContentState } from "@/ee/html-block/types/html-block.types";

export function htmlBlockQueryKey(htmlBlockId: string): unknown[] {
  return ["html-block", htmlBlockId];
}

export function useHtmlBlockContent(
  htmlBlockId: string | null,
): HtmlBlockContentState {
  const { shareId, spaceSlug, preloaded } = useHtmlBlockScope();

  const query = useQuery({
    queryKey: shareId
      ? [...htmlBlockQueryKey(htmlBlockId), "share", shareId]
      : spaceSlug
        ? [...htmlBlockQueryKey(htmlBlockId), "public-space", spaceSlug]
        : htmlBlockQueryKey(htmlBlockId),
    queryFn: () =>
      shareId
        ? getSharedHtmlBlock({ shareId, htmlBlockId })
        : spaceSlug
          ? getPublicSpaceHtmlBlock({ spaceSlug, htmlBlockId })
          : getHtmlBlock(htmlBlockId),
    enabled: !!htmlBlockId && !preloaded,
    staleTime: Infinity,
    retry: false,
  });

  if (preloaded) {
    const content = htmlBlockId ? preloaded[htmlBlockId] : undefined;
    return {
      content,
      isLoading: false,
      error: htmlBlockId && content === undefined ? "unavailable" : null,
    };
  }

  if (!query.isError) {
    return {
      content: query.data?.content,
      isLoading: query.isLoading,
      error: null,
    };
  }

  const disabled =
    isAxiosError(query.error) &&
    query.error.response?.status === 403 &&
    query.error.response.data?.message === HTML_BLOCKS_DISABLED_MESSAGE;

  return {
    content: undefined,
    isLoading: false,
    error: disabled ? "disabled" : "unavailable",
  };
}
