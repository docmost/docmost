import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDebouncedCallback } from "@mantine/hooks";
import {
  usePageQuery,
  useUpdateTitlePageMutation,
  updatePageData,
} from "@/features/page/queries/page-query";
import { useQueryEmit } from "@/features/websocket/use-query-emit";
import { UpdateEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter";
import classes from "@/ee/base/styles/grid.module.css";

// Editable base name for the inline embed. Follows the TitleEditor convention
// (updatePageData + localEmitter + websocket emit) so the sidebar and other
// clients stay in sync. Standalone pages use the page TitleEditor instead.
export function BaseEmbedTitle({ pageId }: { pageId: string }) {
  const { t } = useTranslation();
  const { data: page } = usePageQuery({ pageId });
  const { mutateAsync: updateTitleAsync } = useUpdateTitlePageMutation();
  const emit = useQueryEmit();
  const [value, setValue] = useState("");
  const focusedRef = useRef(false);

  // Keep in sync with the persisted title but never clobber active user input.
  useEffect(() => {
    if (!focusedRef.current) setValue(page?.title ?? "");
  }, [page?.title]);

  const commit = useCallback(() => {
    const trimmed = value.trim();
    if (!page || trimmed === (page.title ?? "")) return;
    updateTitleAsync({ pageId, title: trimmed }).then((updated) => {
      if (updated.title !== trimmed) return;
      const event: UpdateEvent = {
        operation: "updateOne",
        spaceId: updated.spaceId,
        entity: ["pages"],
        id: updated.id,
        payload: {
          title: updated.title,
          slugId: updated.slugId,
          parentPageId: updated.parentPageId,
          icon: updated.icon,
        },
      };
      updatePageData(updated);
      localEmitter.emit("message", event);
      emit(event);
    });
  }, [value, page, pageId, updateTitleAsync, emit]);

  const debouncedCommit = useDebouncedCallback(commit, 500);

  // Force-save any pending edit on unmount (e.g. navigating away mid-type).
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);
  useEffect(() => () => commitRef.current(), []);

  return (
    <input
      className={classes.embedTitleInput}
      value={value}
      placeholder={t("Untitled base")}
      aria-label={t("Base name")}
      onChange={(e) => {
        setValue(e.currentTarget.value);
        debouncedCommit();
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(page?.title ?? "");
          e.currentTarget.blur();
        }
      }}
    />
  );
}
