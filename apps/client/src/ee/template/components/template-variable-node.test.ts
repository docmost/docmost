import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TemplateVariableNode, getTemplateVariables } from "@docmost/editor-ext";
import { afterEach, describe, expect, it } from "vitest";
import { EditableTemplateVariable } from "./template-variable-node";

const project = {
  id: "11111111-1111-7111-8111-111111111111",
  name: "Project",
  fieldType: "text",
  options: [],
};
const content = (attrs = project) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "templateVariable", attrs }] }],
});
const editors: Editor[] = [];

function createEditor(extension: typeof TemplateVariableNode, attrs = project) {
  const editor = new Editor({ extensions: [StarterKit, extension], content: content(attrs) });
  editors.push(editor);
  return editor;
}

afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("template variable chips", () => {
  it("preserves definitions in template previews and pastes readable text into an ordinary page", () => {
    const template = createEditor(TemplateVariableNode);
    const html = template.getHTML();
    template.commands.setContent(html);
    expect(getTemplateVariables(template.getJSON())).toEqual([project]);

    const page = new Editor({ extensions: [StarterKit], content: html });
    editors.push(page);
    expect(page.getJSON().content[0].content).toEqual([{ type: "text", text: "Project" }]);
  });

  it.each([
    { ...project, name: "Previous name" },
    { ...project, name: "project", id: "22222222-2222-7222-8222-222222222222" },
  ])("reuses the destination definition when a copied chip matches by ID or name", (copied) => {
    const original = createEditor(TemplateVariableNode, copied);
    const destination = createEditor(EditableTemplateVariable);
    destination.commands.setTextSelection(1);
    destination.view.pasteHTML(original.getHTML(), new Event("paste") as ClipboardEvent);

    const variables = destination.state.doc.firstChild.content.content;
    expect(variables.map((node) => node.attrs)).toEqual([project, project]);
  });
});
