import React, { useCallback, useMemo, useState } from "react";
import { LinkEditorPanelProps } from "@/features/editor/components/link/types.ts";

export const useLinkEditorState = ({
  initialUrl,
  onSetLink,
}: LinkEditorPanelProps) => {
  const [url, setUrl] = useState(initialUrl || "");

  const onChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  }, []);

  const isValidUrl = useMemo(() => /^(\S+):(\/\/)?\S+$/.test(url), [url]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValidUrl) {
        onSetLink(url);
      }
    },
    [url, isValidUrl, onSetLink],
  );

  return {
    url,
    setUrl,
    onChange,
    handleSubmit,
    isValidUrl,
  };
};
