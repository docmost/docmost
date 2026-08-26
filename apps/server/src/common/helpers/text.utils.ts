export function collapseBlankLines(text: string): string {
  return text.replace(/\n{2,}/g, '\n\n');
}
