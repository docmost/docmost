const CONFLUENCE_HIGHLIGHT_TO_DOCMOST: Record<
  string,
  { color: string; name: string }
> = {
  grey: { color: '#eaecef', name: 'gray' },
  gray: { color: '#eaecef', name: 'gray' },
  blue: { color: '#b4d5ff', name: 'blue' },
  teal: { color: '#b4d5ff', name: 'blue' },
  green: { color: '#acf5d2', name: 'green' },
  yellow: { color: '#fef1b4', name: 'yellow' },
  red: { color: '#ffbead', name: 'red' },
  purple: { color: '#c1b7f2', name: 'purple' },
};

export function mapConfluenceHighlightColor(colour: string): {
  color: string;
  name?: string;
} {
  return (
    CONFLUENCE_HIGHLIGHT_TO_DOCMOST[colour.trim().toLowerCase()] ?? {
      color: colour,
    }
  );
}
