export type TabActions = {
  rename: (index: number) => void;
  finishRename: (index: number, label: string | null) => void;
  duplicate: (index: number) => void;
  move: (from: number, to: number) => void;
  remove: (index: number) => void;
};
