import { describe, expect, it } from "vitest";
import {
  applyPlanChange,
  buildConvertColumns,
  buildImportSpec,
  buildInitialPlans,
  defaultTypeOptions,
  findPlanConflict,
  reconcilePlans,
  takenPropertyNames,
  uniquePropertyName,
} from "./csv-import-mapping";
import type { CsvColumnProfile, CsvTypeSuggestion } from "./csv-import.types";
import type { IBaseProperty } from "@/ee/base/types/base.types";

const hints = { dateOrder: "MDY", decimalSeparator: ".", listSeparator: "," } as const;

function profileFor(suggestion: CsvTypeSuggestion, hasMultipleValues = false): CsvColumnProfile {
  return {
    nonEmpty: 1,
    samples: [],
    distinctCount: 1,
    distinctTokenCount: 1,
    hasMultipleValues,
    hints,
    suggestion,
    issues: {},
  };
}

function property(partial: Partial<IBaseProperty> & Pick<IBaseProperty, "id" | "name" | "type">): IBaseProperty {
  return {
    pageId: "page",
    position: "a0",
    typeOptions: {},
    isPrimary: false,
    workspaceId: "ws",
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const title = property({ id: "prpTitle", name: "Title", type: "text", isPrimary: true });
const status = property({ id: "prpStatus", name: "Status", type: "select" });
const created = property({ id: "prpCreated", name: "Created at", type: "createdAt" });

describe("buildInitialPlans", () => {
  it("maps headers onto existing properties by name, ignoring case", () => {
    const plans = buildInitialPlans(
      ["Name", "status"],
      [profileFor({ type: "text" }), profileFor({ type: "select" })],
      [title, status],
    );
    expect(plans[1].target).toEqual({ kind: "existing", propertyId: "prpStatus" });
  });

  it("maps the first unmatched column to the title", () => {
    const plans = buildInitialPlans(
      ["Name", "Due"],
      [profileFor({ type: "text" }), profileFor({ type: "date" })],
      [title],
    );
    expect(plans[0].target).toEqual({ kind: "existing", propertyId: "prpTitle" });
    expect(plans[1].target).toEqual({ kind: "new", type: "date" });
  });

  it("creates new properties with the suggestion and unique names", () => {
    const plans = buildInitialPlans(
      ["Title", "Created at", "Notes", "Notes"],
      [
        profileFor({ type: "text" }),
        profileFor({ type: "date" }),
        profileFor({ type: "longText" }),
        profileFor({ type: "number", typeOptions: { separators: "local" } }),
      ],
      [title, created],
    );
    expect(plans[0].target).toEqual({ kind: "existing", propertyId: "prpTitle" });
    expect(plans[1]).toMatchObject({ name: "Created at 2", target: { kind: "new", type: "date" } });
    expect(plans[2].name).toBe("Notes");
    expect(plans[3]).toMatchObject({ name: "Notes 2", typeOptions: { separators: "local" } });
  });

  it("never maps two columns onto one property", () => {
    const plans = buildInitialPlans(
      ["Status", "STATUS"],
      [profileFor({ type: "select" }), profileFor({ type: "select" })],
      [title, status],
    );
    expect(plans[0].target).toEqual({ kind: "existing", propertyId: "prpStatus" });
    expect(plans[1].target).toEqual({ kind: "existing", propertyId: "prpTitle" });
  });
});

describe("spec building", () => {
  it("includes only chosen columns, in file order", () => {
    const properties = [title, status];
    const byId = new Map(properties.map((p) => [p.id, p]));
    const plans = buildInitialPlans(
      ["Name", "Status", "Due", "Skip me"],
      [
        profileFor({ type: "text" }),
        profileFor({ type: "select" }),
        profileFor({ type: "date", typeOptions: { includeTime: true } }),
        profileFor({ type: "text" }),
      ],
      properties,
    );
    plans[3].include = false;

    expect(buildImportSpec(plans, byId, "tasks.csv", 10)).toEqual({
      fileName: "tasks.csv",
      rowCount: 10,
      columns: [
        { propertyId: "prpTitle" },
        { propertyId: "prpStatus" },
        { name: "Due", type: "date", typeOptions: { includeTime: true } },
      ],
    });
    expect(buildConvertColumns(plans, byId).map((c) => [c.index, c.type])).toEqual([
      [0, "text"],
      [1, "select"],
      [2, "date"],
    ]);
  });
});

describe("defaultTypeOptions", () => {
  it("allows several people when cells hold more than one name", () => {
    expect(defaultTypeOptions("person", profileFor({ type: "multiSelect" }, true))).toEqual({
      allowMultiple: true,
    });
    expect(defaultTypeOptions("person", profileFor({ type: "text" }))).toEqual({
      allowMultiple: false,
    });
  });

  it("keeps the suggestion's options only for the suggested type", () => {
    const profile = profileFor({ type: "date", typeOptions: { includeTime: true } });
    expect(defaultTypeOptions("date", profile)).toEqual({ includeTime: true });
    expect(defaultTypeOptions("text", profile)).toBeUndefined();
    expect(defaultTypeOptions("number", profile)).toEqual({ separators: "local" });
  });
});

describe("reconcilePlans", () => {
  const profiles = [profileFor({ type: "text" }), profileFor({ type: "select" })];

  it("renames a new property when a property with its name appears", () => {
    const plans = buildInitialPlans(["Name", "City"], profiles, [title]);
    const city = property({ id: "prpCity", name: "city", type: "text" });
    expect(reconcilePlans(plans, [title, city], profiles)[1].name).toBe("City 2");
    expect(reconcilePlans(plans, [title], profiles)).toBe(plans);
  });

  it("turns a column mapped to a deleted property into a new property", () => {
    const plans = buildInitialPlans(["Name", "Status"], profiles, [title, status]);
    const next = reconcilePlans(plans, [title], profiles);
    expect(next[1]).toMatchObject({ name: "Status", target: { kind: "new", type: "select" } });
  });
});

describe("applyPlanChange", () => {
  const notesProfiles = [
    profileFor({ type: "text" }),
    profileFor({ type: "longText" }),
    profileFor({ type: "longText" }),
  ];

  it("renames a column brought back to a name another column took meanwhile", () => {
    const properties = [title, status];
    let plans = buildInitialPlans(["Name", "Notes", "Notes"], notesProfiles, properties);
    const change = (index: number, patch: Parameters<typeof applyPlanChange>[2]) => {
      plans = applyPlanChange(plans, index, patch, properties, notesProfiles);
    };

    change(1, { include: false });
    change(2, { target: { kind: "existing", propertyId: "prpStatus" } });
    change(2, {
      target: { kind: "new", type: "longText" },
      name: uniquePropertyName("Notes", takenPropertyNames(plans, properties, 2)),
    });
    expect(plans[2].name).toBe("Notes");
    change(1, { include: true });

    expect(plans.map((p) => p.name)).toEqual(["Title", "Notes 2", "Notes"]);
    expect(findPlanConflict(plans, new Map(properties.map((p) => [p.id, p])))).toBeNull();
  });

  it("makes a column brought back to a taken property a new property", () => {
    const properties = [title, status];
    let plans = buildInitialPlans(["Name", "Status", "State"], notesProfiles, properties);
    plans = applyPlanChange(plans, 1, { include: false }, properties, notesProfiles);
    plans = applyPlanChange(
      plans,
      2,
      { target: { kind: "existing", propertyId: "prpStatus" } },
      properties,
      notesProfiles,
    );
    plans = applyPlanChange(plans, 1, { include: true }, properties, notesProfiles);

    expect(plans[1]).toMatchObject({
      include: true,
      name: "Status 2",
      target: { kind: "new", type: "longText" },
    });
    expect(plans[2].target).toEqual({ kind: "existing", propertyId: "prpStatus" });
  });

  it("leaves other columns and excluded columns alone", () => {
    const plans = buildInitialPlans(["Name", "Notes", "Notes"], notesProfiles, [title]);
    const next = applyPlanChange(plans, 2, { include: false }, [title], notesProfiles);
    expect(next[0]).toBe(plans[0]);
    expect(next[1]).toBe(plans[1]);
    expect(next[2]).toMatchObject({ include: false, name: "Notes 2" });
  });
});

describe("findPlanConflict", () => {
  const byId = new Map([title, status].map((p) => [p.id, p]));
  const profiles = [profileFor({ type: "text" }), profileFor({ type: "text" })];

  it("reports a property chosen for two columns", () => {
    const plans = buildInitialPlans(["Name", "Status"], profiles, [title, status]);
    plans[1].target = { kind: "existing", propertyId: "prpTitle" };
    expect(findPlanConflict(plans, byId)).toEqual({ kind: "property", name: "Title" });
  });

  it("reports a new name held twice or by an existing property", () => {
    const plans = buildInitialPlans(["Name", "Notes", "Tags"], [...profiles, profiles[0]], [title]);
    plans[2].name = " notes ";
    expect(findPlanConflict(plans, byId)).toEqual({ kind: "name", name: "notes" });
    plans[2].name = "STATUS";
    expect(findPlanConflict(plans, byId)).toEqual({ kind: "name", name: "STATUS" });
  });

  it("ignores excluded columns", () => {
    const plans = buildInitialPlans(["Name", "Status"], profiles, [title, status]);
    plans[1].target = { kind: "existing", propertyId: "prpTitle" };
    plans[1].include = false;
    expect(findPlanConflict(plans, byId)).toBeNull();
  });
});

describe("names", () => {
  it("adds a number until the name is free", () => {
    expect(uniquePropertyName("Notes", new Set(["notes", "notes 2"]))).toBe("Notes 3");
    expect(uniquePropertyName(" Due ", new Set())).toBe("Due");
  });

  it("cuts long headers to 255 characters, leaving room for the number", () => {
    const header = "q".repeat(300);
    const name = uniquePropertyName(header, new Set());
    expect(name).toBe("q".repeat(255));
    expect(uniquePropertyName(header, new Set([name]))).toBe(`${"q".repeat(253)} 2`);
    expect(uniquePropertyName(`${"a".repeat(254)}😀`, new Set())).toBe("a".repeat(254));
  });

  it("collects names held by existing properties and other new columns", () => {
    const plans = buildInitialPlans(
      ["Name", "Notes", "Tags"],
      [profileFor({ type: "text" }), profileFor({ type: "text" }), profileFor({ type: "text" })],
      [title],
    );
    expect(takenPropertyNames(plans, [title], 1)).toEqual(new Set(["title", "tags"]));
  });
});
