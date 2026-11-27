import type { Editor } from "@tiptap/core";
import {
  canPlaceLinkDisplayCard,
  convertLinkDisplay,
  getLinkDisplayCardAvailability,
  getSelectedLinkDisplay,
  type LinkDisplay,
  type LinkDisplayLinkSource,
  type LinkDisplayNodeSource,
  type LinkDisplayNodes,
} from "@/features/editor/utils/link-display";

export type IntegrationDisplay = LinkDisplay;

export type IntegrationCardAvailability = { canUseCard: boolean };

export type IntegrationDisplaySource =
  | LinkDisplayNodeSource
  | (Omit<LinkDisplayLinkSource, "attrs"> & { provider: string });

export type SelectedIntegrationDisplay = {
  current: Exclude<IntegrationDisplay, "url">;
  source: Extract<IntegrationDisplaySource, { kind: "node" }>;
  url: string;
};

const INTEGRATION_NODES: LinkDisplayNodes = {
  card: "integrationCard",
  mention: "integrationMention",
  toLinkAttrs: (attrs) => ({
    href: attrs.url,
    integrationProvider: attrs.provider,
  }),
};

function toLinkDisplaySource(source: IntegrationDisplaySource) {
  if (source.kind === "node") return source;
  const { provider, ...rest } = source;
  return { ...rest, attrs: { url: source.url, provider } };
}

export function getSelectedIntegrationDisplay(
  editor: Editor,
): SelectedIntegrationDisplay | null {
  return getSelectedLinkDisplay(editor, INTEGRATION_NODES);
}

export function getIntegrationCardAvailability(
  editor: Editor,
  source: IntegrationDisplaySource,
): IntegrationCardAvailability {
  return getLinkDisplayCardAvailability(
    editor,
    toLinkDisplaySource(source),
    INTEGRATION_NODES,
  );
}

export function canPlaceIntegrationCard(editor: Editor, pos: number): boolean {
  return canPlaceLinkDisplayCard(editor, pos, INTEGRATION_NODES);
}

export function convertIntegrationDisplay(
  editor: Editor,
  source: IntegrationDisplaySource,
  target: IntegrationDisplay,
): boolean {
  return convertLinkDisplay(
    editor,
    toLinkDisplaySource(source),
    target,
    INTEGRATION_NODES,
  );
}
