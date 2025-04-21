export type LinkEditorPanelProps = {
  initialUrl?: string;
  onSetLink: (url: string, openInNewTab?: boolean) => void;
};
