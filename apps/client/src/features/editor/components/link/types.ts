export type LinkEditorPanelProps = {
  initialUrl?: string;
  onSetLink: (url: string, internal?: boolean) => void;
  onUnsetLink?: () => void;
};
