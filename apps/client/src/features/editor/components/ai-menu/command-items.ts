import { AiAction } from "@/ee/ai/types/ai.types";
import {
  IconSparkles,
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconWriting,
  IconHelp,
  IconList,
  IconMoodSmile,
  IconLanguage,
  IconTrash,
  IconRefresh,
  IconChevronLeft,
  IconCheck,
  IconArrowDownLeft,
  IconCopy,
} from "@tabler/icons-react";

interface CommandItem {
  name: string;
  id: string;
  icon?: typeof IconSparkles;
  action?: AiAction;
  prompt?: string;
  subCommandSet?: CommandSet;
}

type CommandSet = "main" | "tone" | "translate" | "result";

const mainItems: CommandItem[] = [
  {
    id: "improve-writing",
    name: "Improve writing",
    icon: IconSparkles,
    action: AiAction.IMPROVE_WRITING,
  },
  {
    id: "fix-spelling-grammar",
    name: "Fix spelling & grammar",
    icon: IconCheck,
    action: AiAction.FIX_SPELLING_GRAMMAR,
  },
  {
    id: "make-longer",
    name: "Make longer",
    icon: IconArrowsMaximize,
    action: AiAction.MAKE_LONGER,
  },
  {
    id: "make-shorter",
    name: "Make shorter",
    icon: IconArrowsMinimize,
    action: AiAction.MAKE_SHORTER,
  },
  {
    id: "continue-writing",
    name: "Continue writing",
    icon: IconWriting,
    action: AiAction.CONTINUE_WRITING,
  },
  {
    id: "explain",
    name: "Explain",
    icon: IconHelp,
    action: AiAction.CUSTOM,
    prompt: "Explain this text",
  },
  {
    id: "summarize",
    name: "Summarize",
    icon: IconList,
    action: AiAction.SUMMARIZE,
  },
  {
    id: "change-tone",
    name: "Change tone...",
    icon: IconMoodSmile,
    subCommandSet: "tone",
  },
  {
    id: "translate",
    name: "Translate...",
    icon: IconLanguage,
    subCommandSet: "translate",
  },
];
const toneItems: CommandItem[] = [
  {
    id: "back",
    name: "Back",
    icon: IconChevronLeft,
  },
  {
    id: "tone-professional",
    name: "Professional",
    icon: IconMoodSmile,
    action: AiAction.CHANGE_TONE,
    prompt: "Professional",
  },
  {
    id: "tone-casual",
    name: "Casual",
    icon: IconMoodSmile,
    action: AiAction.CHANGE_TONE,
    prompt: "Casual",
  },
  {
    id: "tone-friendly",
    name: "Friendly",
    icon: IconMoodSmile,
    action: AiAction.CHANGE_TONE,
    prompt: "Friendly",
  },
];
const translateItems: CommandItem[] = [
  {
    id: "back",
    name: "Back",
    icon: IconChevronLeft,
  },
  {
    id: "translate-english",
    name: "English",
    icon: IconLanguage,
    action: AiAction.TRANSLATE,
    prompt: "English",
  },
  {
    id: "translate-french",
    name: "French",
    icon: IconLanguage,
    action: AiAction.TRANSLATE,
    prompt: "French",
  },
  {
    id: "translate-german",
    name: "German",
    icon: IconLanguage,
    action: AiAction.TRANSLATE,
    prompt: "German",
  },
];
const resultItems: CommandItem[] = [
  { id: "result-replace", name: "Replace", icon: IconCheck },
  { id: "result-insert-below", name: "Insert below", icon: IconArrowDownLeft },
  { id: "result-copy", name: "Copy", icon: IconCopy },
  { id: "result-discard", name: "Discard", icon: IconTrash },
  {
    id: "result-try-again",
    name: "Try again",
    icon: IconRefresh,
  },
];
const commandItems: Record<CommandSet, CommandItem[]> = {
  main: mainItems,
  tone: toneItems,
  translate: translateItems,
  result: resultItems,
};

export type { CommandItem, CommandSet };
export { commandItems };
