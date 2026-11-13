import {
  CSV_IMPORT_PROPERTY_TYPES,
  MAX_PROPERTY_NAME_LENGTH,
} from "@/ee/base/csv-import/csv-import.constants";
import { truncateText } from "@/ee/base/csv-import/csv-value-parsers";
import type {
  BaseCsvImportSpec,
  CsvColumnPlan,
  CsvColumnProfile,
  CsvConvertColumn,
  CsvImportPropertyType,
} from "@/ee/base/csv-import/csv-import.types";
import type { IBaseProperty } from "@/ee/base/types/base.types";

const IMPORTABLE_TYPES = new Set<string>(CSV_IMPORT_PROPERTY_TYPES);

const nameKey = (name: string) => name.trim().toLowerCase();

export function isImportableProperty(property: IBaseProperty): boolean {
  return IMPORTABLE_TYPES.has(property.type) && !property.pendingType;
}

// spreadsheet-style column label: 0 is A, 25 is Z, 26 is AA
export function columnLetter(index: number): string {
  let label = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  }
  return label;
}

// long headers are cut so the name and its number suffix fit the server's limit
export function uniquePropertyName(base: string, taken: Set<string>): string {
  const name = truncateText(base.trim(), MAX_PROPERTY_NAME_LENGTH).trim();
  if (!taken.has(nameKey(name))) return name;
  for (let n = 2; ; n++) {
    const suffix = ` ${n}`;
    const candidate =
      truncateText(name, MAX_PROPERTY_NAME_LENGTH - suffix.length).trimEnd() + suffix;
    if (!taken.has(nameKey(candidate))) return candidate;
  }
}

export function defaultTypeOptions(
  type: CsvImportPropertyType,
  profile: CsvColumnProfile,
): Record<string, unknown> | undefined {
  if (type === profile.suggestion.type) return profile.suggestion.typeOptions;
  if (type === "number") return { separators: "local" };
  if (type === "person") return { allowMultiple: profile.hasMultipleValues };
  return undefined;
}

export function buildInitialPlans(
  headers: string[],
  profiles: CsvColumnProfile[],
  properties: IBaseProperty[],
): CsvColumnPlan[] {
  const importable = properties.filter(isImportableProperty);
  const byName = new Map(importable.map((p) => [nameKey(p.name), p]));
  const used = new Set<string>();

  const matched = headers.map((header) => {
    const property = byName.get(nameKey(header));
    if (!property || used.has(property.id)) return null;
    used.add(property.id);
    return property;
  });

  const primary = importable.find((p) => p.isPrimary);
  if (primary && !used.has(primary.id)) {
    const first = matched.findIndex((p) => p === null);
    if (first !== -1) {
      matched[first] = primary;
      used.add(primary.id);
    }
  }

  const taken = new Set(properties.map((p) => nameKey(p.name)));
  return headers.map((header, index) => {
    const profile = profiles[index];
    const property = matched[index];
    if (property) {
      return {
        index,
        header,
        include: true,
        name: property.name,
        target: { kind: "existing", propertyId: property.id },
        hints: profile.hints,
      };
    }
    const name = uniquePropertyName(header, taken);
    taken.add(nameKey(name));
    const type = profile.suggestion.type;
    return {
      index,
      header,
      include: true,
      name,
      target: { kind: "new", type },
      hints: profile.hints,
      typeOptions: defaultTypeOptions(type, profile),
    };
  });
}

export function planTargetType(
  plan: CsvColumnPlan,
  propertiesById: Map<string, IBaseProperty>,
): CsvImportPropertyType | null {
  if (plan.target.kind === "new") return plan.target.type;
  const property = propertiesById.get(plan.target.propertyId);
  return property && isImportableProperty(property)
    ? (property.type as CsvImportPropertyType)
    : null;
}

// names other plans or existing properties already hold, for renaming one plan
export function takenPropertyNames(
  plans: CsvColumnPlan[],
  properties: IBaseProperty[],
  exceptIndex: number,
): Set<string> {
  const taken = new Set(properties.map((p) => nameKey(p.name)));
  for (const plan of plans) {
    if (plan.index === exceptIndex || !plan.include) continue;
    if (plan.target.kind === "new") taken.add(nameKey(plan.name));
  }
  return taken;
}

export function planNameTaken(
  plans: CsvColumnPlan[],
  properties: IBaseProperty[],
  plan: CsvColumnPlan,
): boolean {
  if (!plan.include || plan.target.kind !== "new") return false;
  return takenPropertyNames(plans, properties, plan.index).has(nameKey(plan.name));
}

// properties can change while the dialog is open: mapped ones may go away, new names may clash
export function reconcilePlans(
  plans: CsvColumnPlan[],
  properties: IBaseProperty[],
  profiles: CsvColumnProfile[],
): CsvColumnPlan[] {
  const importable = new Set(properties.filter(isImportableProperty).map((p) => p.id));
  const taken = new Set(properties.map((p) => nameKey(p.name)));
  let changed = false;
  const next = plans.map((plan): CsvColumnPlan => {
    if (plan.target.kind === "existing") {
      if (importable.has(plan.target.propertyId)) return plan;
      changed = true;
      const profile = profiles[plan.index];
      const type = profile.suggestion.type;
      const name = uniquePropertyName(plan.header, taken);
      taken.add(nameKey(name));
      return {
        ...plan,
        name,
        target: { kind: "new", type },
        typeOptions: defaultTypeOptions(type, profile),
      };
    }
    const name = uniquePropertyName(plan.name, taken);
    taken.add(nameKey(name));
    if (name === plan.name) return plan;
    changed = true;
    return { ...plan, name };
  });
  return changed ? next : plans;
}

// excluded columns hold nothing, so the changed column gives way when it comes back to a taken name or property
export function applyPlanChange(
  plans: CsvColumnPlan[],
  index: number,
  patch: Partial<CsvColumnPlan>,
  properties: IBaseProperty[],
  profiles: CsvColumnProfile[],
): CsvColumnPlan[] {
  return plans.map((plan): CsvColumnPlan => {
    if (plan.index !== index) return plan;
    const next = { ...plan, ...patch };
    if (!next.include) return next;
    const taken = takenPropertyNames(plans, properties, index);
    if (next.target.kind === "new") {
      // a name the user typed stays as typed; planNameTaken flags the clash on the column
      if (patch.name !== undefined) return next;
      return taken.has(nameKey(next.name))
        ? { ...next, name: uniquePropertyName(next.header, taken) }
        : next;
    }
    const { propertyId } = next.target;
    const mappedElsewhere = plans.some(
      (p) =>
        p.index !== index &&
        p.include &&
        p.target.kind === "existing" &&
        p.target.propertyId === propertyId,
    );
    if (!mappedElsewhere) return next;
    const profile = profiles[index];
    const type = profile.suggestion.type;
    return {
      ...next,
      name: uniquePropertyName(next.header, taken),
      target: { kind: "new", type },
      typeOptions: defaultTypeOptions(type, profile),
    };
  });
}

// the server refuses these too, but only after the rows were prepared and uploaded
export function findPlanConflict(
  plans: CsvColumnPlan[],
  propertiesById: Map<string, IBaseProperty>,
): { kind: "property" | "name"; name: string } | null {
  const names = new Set(Array.from(propertiesById.values(), (p) => nameKey(p.name)));
  const mapped = new Set<string>();
  for (const plan of includedPlans(plans, propertiesById)) {
    if (plan.target.kind === "existing") {
      const { propertyId } = plan.target;
      if (mapped.has(propertyId)) {
        return { kind: "property", name: propertiesById.get(propertyId)!.name };
      }
      mapped.add(propertyId);
      continue;
    }
    const key = nameKey(plan.name);
    if (names.has(key)) return { kind: "name", name: plan.name.trim() };
    names.add(key);
  }
  return null;
}

export function includedPlans(
  plans: CsvColumnPlan[],
  propertiesById: Map<string, IBaseProperty>,
): CsvColumnPlan[] {
  return plans.filter(
    (plan) => plan.include && planTargetType(plan, propertiesById) !== null,
  );
}

export function buildConvertColumns(
  plans: CsvColumnPlan[],
  propertiesById: Map<string, IBaseProperty>,
): CsvConvertColumn[] {
  return includedPlans(plans, propertiesById).map((plan) => ({
    index: plan.index,
    type: planTargetType(plan, propertiesById)!,
    hints: plan.hints,
  }));
}

export function buildImportSpec(
  plans: CsvColumnPlan[],
  propertiesById: Map<string, IBaseProperty>,
  fileName: string,
  rowCount: number,
): BaseCsvImportSpec {
  return {
    fileName,
    rowCount,
    columns: includedPlans(plans, propertiesById).map((plan) =>
      plan.target.kind === "existing"
        ? { propertyId: plan.target.propertyId }
        : {
            name: plan.name.trim(),
            type: plan.target.type,
            ...(plan.typeOptions ? { typeOptions: plan.typeOptions } : {}),
          },
    ),
  };
}
