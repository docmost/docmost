/**
 * Code-block languages that render a diagram preview below the source
 * and collapse their source when the block is not selected.
 */
export const DIAGRAM_LANGUAGES = ["mermaid", "plantuml"] as const;

export function isDiagramLanguage(
  language: string | null | undefined,
): boolean {
  if (!language) return false;
  return (DIAGRAM_LANGUAGES as readonly string[]).includes(language);
}
