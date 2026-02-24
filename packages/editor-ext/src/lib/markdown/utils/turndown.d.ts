// Map @joplin/turndown types to @types/turndown
declare module "@joplin/turndown" {
  import TurndownService from "turndown";
  export = TurndownService;
}

declare module "@joplin/turndown-plugin-gfm" {
  import TurndownService from "turndown";
  export const tables: TurndownService.Plugin;
  export const strikethrough: TurndownService.Plugin;
  export const highlightedCodeBlock: TurndownService.Plugin;
}
