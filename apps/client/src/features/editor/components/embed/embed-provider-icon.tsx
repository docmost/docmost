import { ComponentType } from "react";
import { IconAppWindow } from "@tabler/icons-react";
import {
  AirtableIcon,
  FigmaIcon,
  FramerIcon,
  GoogleDriveIcon,
  LoomIcon,
  MiroIcon,
  TypeformIcon,
  VimeoIcon,
  YoutubeIcon,
} from "@/components/icons";

const PROVIDER_ICONS: Record<
  string,
  ComponentType<{ size?: number | string }>
> = {
  airtable: AirtableIcon,
  figma: FigmaIcon,
  framer: FramerIcon,
  gdrive: GoogleDriveIcon,
  loom: LoomIcon,
  miro: MiroIcon,
  typeform: TypeformIcon,
  vimeo: VimeoIcon,
  youtube: YoutubeIcon,
};

type EmbedProviderIconProps = {
  providerId: string;
  size: number;
};

export function EmbedProviderIcon({ providerId, size }: EmbedProviderIconProps) {
  const Icon = PROVIDER_ICONS[providerId] ?? IconAppWindow;
  return <Icon size={size} />;
}
