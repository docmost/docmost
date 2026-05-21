import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskItem } from "./custom-task-item";

describe("custom TaskItem extension", () => {
  it("has the correct name", () => {
    expect(TaskItem.name).toBe("taskItem");
  });

  it("has the checked attribute with default false", () => {
    const attrs = TaskItem.config.addAttributes();
    expect(attrs.checked).toBeDefined();
    expect(attrs.checked.default).toBe(false);
    expect(attrs.checked.keepOnSplit).toBe(false);
  });

  it("parses data-checked attribute", () => {
    const attrs = TaskItem.config.addAttributes();
    const parseHTML = attrs.checked.parseHTML;

    const elWithChecked = document.createElement("li");
    elWithChecked.setAttribute("data-checked", "true");
    expect(parseHTML(elWithChecked)).toBe(true);

    const elWithoutChecked = document.createElement("li");
    expect(parseHTML(elWithoutChecked)).toBe(false);
  });

  it("supports nested content", () => {
    const ext = TaskItem.configure({ nested: true });
    expect(ext.config.nested).toBe(true);
  });

  it("defines content for nested mode", () => {
    const ext = TaskItem.configure({ nested: true });
    const contentFn = ext.config.content;
    expect(contentFn()).toBe("paragraph block*");
  });

  it("defines content for non-nested mode", () => {
    const ext = TaskItem.configure({ nested: false });
    const contentFn = ext.config.content;
    expect(contentFn()).toBe("paragraph+");
  });

  it("keyboard shortcuts include Enter and Shift-Tab", () => {
    const shortcuts = TaskItem.config.addKeyboardShortcuts();
    expect(shortcuts).toHaveProperty("Enter");
    expect(shortcuts).toHaveProperty("Shift-Tab");
  });
});
