import { NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { buildPlantumlImageUrl } from "@docmost/editor-ext";
import { getPlantumlFormat, getPlantumlUrl } from "@/lib/config";
import classes from "./code-block.module.css";
import { useTranslation } from "react-i18next";

interface PlantumlViewProps {
  props: NodeViewProps;
}

const DEBOUNCE_MS = 500;

export default function PlantumlView({ props }: PlantumlViewProps) {
  const { t } = useTranslation();
  const { node, editor } = props;
  const source = node.textContent;

  // Debounce so typing does not fire a request per keystroke.
  const [debouncedSource, setDebouncedSource] = useState(source);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSource(source), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [source]);

  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Encoding is async (Compression Streams API), so this is an effect
  // rather than a useMemo.
  useEffect(() => {
    if (debouncedSource.length === 0) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    setError(null);

    buildPlantumlImageUrl(
      getPlantumlUrl(),
      getPlantumlFormat(),
      debouncedSource,
    )
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(t("Invalid PlantUML diagram"));
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSource, t]);

  if (debouncedSource.length === 0) {
    return null;
  }

  if (error) {
    return (
      <div className={classes.error} contentEditable={false}>
        {error}
      </div>
    );
  }

  // Wait for the encoded URL: rendering <img src=""> first makes the browser
  // fire onError, which would latch a spurious "cannot reach the server"
  // message that no later successful load can clear.
  if (!imageUrl) {
    return null;
  }

  return (
    <div className={classes.plantuml} contentEditable={false}>
      <img
        src={imageUrl}
        alt={t("PlantUML diagram")}
        style={{ maxWidth: "100%" }}
        onError={() =>
          setError(
            editor.isEditable
              ? t("PlantUML diagram error: could not reach the PlantUML server")
              : t("Invalid PlantUML diagram"),
          )
        }
      />
    </div>
  );
}
