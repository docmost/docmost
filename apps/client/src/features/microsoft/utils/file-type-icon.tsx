import {
  IconFile,
  IconFileSpreadsheet,
  IconFileText,
  IconFileTypePdf,
  IconFolder,
  IconList,
  IconPhoto,
  IconPresentation,
  IconVideo,
  IconWorld,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

type Props = {
  name?: string;
  mimeType?: string;
  kind?: "file" | "folder" | "list" | "site";
  size?: number;
};

export function fileTypeIcon({ name, mimeType, kind = "file", size = 18 }: Props): ReactNode {
  if (kind === "folder") return <IconFolder size={size} stroke={1.5} />;
  if (kind === "list") return <IconList size={size} stroke={1.5} />;
  if (kind === "site") return <IconWorld size={size} stroke={1.5} />;
  const extension = name?.split(".").pop()?.toLowerCase() ?? "";
  if (["doc", "docx", "txt", "md", "one"].includes(extension)) {
    return <IconFileText size={size} stroke={1.5} color="#2b579a" />;
  }
  if (["xls", "xlsx", "csv"].includes(extension)) {
    return <IconFileSpreadsheet size={size} stroke={1.5} color="#217346" />;
  }
  if (["ppt", "pptx"].includes(extension)) {
    return <IconPresentation size={size} stroke={1.5} color="#d24726" />;
  }
  if (extension === "pdf") return <IconFileTypePdf size={size} stroke={1.5} color="#c8102e" />;
  if (mimeType?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "svg"].includes(extension)) {
    return <IconPhoto size={size} stroke={1.5} />;
  }
  if (mimeType?.startsWith("video/") || ["mp4", "mov"].includes(extension)) {
    return <IconVideo size={size} stroke={1.5} />;
  }
  return <IconFile size={size} stroke={1.5} />;
}
