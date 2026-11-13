import {
  CHOICE_COLORS,
  STATUS_CATEGORY_COLORS,
  STATUS_COMPLETE_WORDS,
  STATUS_IN_PROGRESS_WORDS,
} from "@/ee/base/csv-import/csv-import.constants";
import type { Choice } from "@/ee/base/types/base.types";

export type StatusCategory = "todo" | "inProgress" | "complete";

export function guessStatusCategory(name: string): StatusCategory {
  const key = name.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (STATUS_COMPLETE_WORDS.has(key)) return "complete";
  if (STATUS_IN_PROGRESS_WORDS.has(key)) return "inProgress";
  return "todo";
}

// mirrors how the import assigns colors, so first-seen values preview in their final color
export function previewChoiceColors(
  type: "select" | "status" | "multiSelect",
  existing: Choice[],
  names: string[],
): Map<string, string> {
  const colors = new Map<string, string>();
  // the first of two names that differ only by case is the one the import matches
  for (const choice of existing) {
    const key = choice.name.trim().toLowerCase();
    if (!colors.has(key)) colors.set(key, choice.color);
  }
  let count = existing.length;
  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key || colors.has(key)) continue;
    colors.set(
      key,
      type === "status"
        ? STATUS_CATEGORY_COLORS[guessStatusCategory(name)]
        : CHOICE_COLORS[count % CHOICE_COLORS.length],
    );
    count++;
  }
  return colors;
}
