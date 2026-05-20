/**
 * Top-level block node types allowed inside a `transclusionSource`.
 * Notably excludes:
 * - `transclusionSource` — sync blocks cannot wrap other sync blocks (sources are leaves).
 * - `transclusionReference` — sync blocks cannot transclude other sync blocks,
 *   which keeps the transclusion graph acyclic and lets the renderer skip
 *   cycle-aware traversal entirely.
 *
 * Also excludes child-only nodes (`listItem`, `tableRow`, `column`, etc.)
 * — they're already constrained by their parent containers.
 */
export const TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'bulletList',
  'orderedList',
  'taskList',
  'image',
  'video',
  'audio',
  'attachment',
  'callout',
  'details',
  'embed',
  'mathBlock',
  'table',
  'drawio',
  'excalidraw',
  'pdf',
  'subpages',
  'columns',
  'youtube',
] as const;

export type TransclusionSourceAllowedNodeType =
  (typeof TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES)[number];

export const TRANSCLUSION_SOURCE_CONTENT_EXPRESSION = `(${TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES.join(' | ')})+`;
