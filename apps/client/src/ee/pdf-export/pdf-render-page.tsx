import "@/features/editor/styles/index.css";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor";
import { Container } from "@mantine/core";

type PdfRenderData = {
  pageId: string;
  title: string;
  content: any;
  htmlBlocks: Record<string, string>;
};

export default function PdfRenderPage() {
  const { pageId } = useParams<{ pageId: string }>();
  const [searchParams] = useSearchParams();
  // HTML block scripts can read this page's URL, so the token leaves the address bar before any block renders
  const [token] = useState(() => {
    window.history.replaceState(null, "", window.location.pathname);
    return searchParams.get("token");
  });

  const [data, setData] = useState<PdfRenderData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pageId || !token) {
      setError("Missing page ID or token");
      return;
    }

    fetch('/api/pdf-export/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId, token }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((result) => setData(result.data))
      .catch((err) => setError(err.message));
  }, [pageId, token]);

  useEffect(() => {
    if (data?.title) {
      document.title = data.title;
    }
  }, [data?.title]);

  if (error) {
    return <div>{error}</div>;
  }

  if (!data) {
    return null;
  }

  return (
    <Container size={900} p={0}>
      <ReadonlyPageEditor
        key={data.pageId}
        title={data.title}
        content={data.content}
        pageId={data.pageId}
        htmlBlocks={data.htmlBlocks}
        printMode
      />
    </Container>
  );
}
