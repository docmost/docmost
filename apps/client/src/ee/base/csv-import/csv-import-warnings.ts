import { PROPERTY_TYPE_REGISTRY } from "@/ee/base/property-types/property-type.registry";
import {
  MAX_IMPORT_CHOICES,
  MAX_LONG_TEXT_LENGTH,
  MAX_TEXT_LENGTH,
} from "@/ee/base/csv-import/csv-import.constants";
import type {
  CsvColumnProfile,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";

// the choice count is an upper bound: values matching existing choices are counted twice
export function columnWarning(
  t: (key: string, options?: Record<string, unknown>) => string,
  type: CsvImportPropertyType,
  profile: CsvColumnProfile,
  existingChoices: number,
): string | null {
  const count = profile.issues[type] ?? 0;
  const label = t(PROPERTY_TYPE_REGISTRY[type].labelKey);

  if (type === "text" || type === "longText") {
    if (count === 0) return null;
    return t("{{count}} values are longer than {{max}} characters and will be shortened.", {
      count,
      max: type === "text" ? MAX_TEXT_LENGTH : MAX_LONG_TEXT_LENGTH,
    });
  }
  if (type === "select" || type === "status" || type === "multiSelect") {
    const distinct = type === "multiSelect" ? profile.distinctTokenCount : profile.distinctCount;
    if (existingChoices + distinct > MAX_IMPORT_CHOICES) {
      return t("A property can have up to {{max}} options. Values beyond that will be left empty.", {
        max: MAX_IMPORT_CHOICES,
      });
    }
  }
  if (count === 0) return null;
  return t("{{count}} values can't be read as {{type}} and will be left empty.", {
    count,
    type: label,
  });
}
