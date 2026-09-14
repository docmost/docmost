import { ThemeIcon } from "@mantine/core";
import {
  IconFile,
  IconFileTypeCsv,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileTypePpt,
  IconFileTypeXls,
  IconFileZip,
  IconMovie,
  IconMusic,
  IconPhoto,
  type Icon,
} from "@tabler/icons-react";

const EXT_ICONS: Record<string, { icon: Icon; color: string }> = {
  ".pdf": { icon: IconFileTypePdf, color: "red" },
  ".doc": { icon: IconFileTypeDocx, color: "blue" },
  ".docx": { icon: IconFileTypeDocx, color: "blue" },
  ".xls": { icon: IconFileTypeXls, color: "teal" },
  ".xlsx": { icon: IconFileTypeXls, color: "teal" },
  ".csv": { icon: IconFileTypeCsv, color: "teal" },
  ".ppt": { icon: IconFileTypePpt, color: "orange" },
  ".pptx": { icon: IconFileTypePpt, color: "orange" },
  ".zip": { icon: IconFileZip, color: "gray" },
  ".rar": { icon: IconFileZip, color: "gray" },
  ".7z": { icon: IconFileZip, color: "gray" },
  ".tar": { icon: IconFileZip, color: "gray" },
  ".gz": { icon: IconFileZip, color: "gray" },
};

const MIME_ICONS: Array<{ prefix: string; icon: Icon; color: string }> = [
  { prefix: "image/", icon: IconPhoto, color: "grape" },
  { prefix: "video/", icon: IconMovie, color: "violet" },
  { prefix: "audio/", icon: IconMusic, color: "pink" },
];

interface AttachmentFileIconProps {
  fileExt?: string;
  mimeType?: string;
}

export function AttachmentFileIcon({
  fileExt,
  mimeType,
}: AttachmentFileIconProps) {
  const byExt = fileExt ? EXT_ICONS[fileExt.toLowerCase()] : undefined;
  const byMime = mimeType
    ? MIME_ICONS.find((entry) => mimeType.startsWith(entry.prefix))
    : undefined;
  const { icon: FileIcon, color } = byExt ??
    byMime ?? { icon: IconFile, color: "gray" };

  return (
    <ThemeIcon variant="light" color={color} size={40} radius="md">
      <FileIcon size={22} stroke={1.5} />
    </ThemeIcon>
  );
}
