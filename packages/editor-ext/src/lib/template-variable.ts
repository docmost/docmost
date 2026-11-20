import { Node, type JSONContent } from '@tiptap/core';
import { validate as isUuid } from 'uuid';

export type TemplateVariable = {
  id: string;
  name: string;
  fieldType: 'text' | 'multiline' | 'select';
  options: string[];
};

export const templateVariableNameKey = (name: string) => name.trim().toLowerCase();

function isTemplateVariable(attrs: Record<string, unknown>): attrs is TemplateVariable {
  const singleLine = (value: unknown) =>
    typeof value === 'string' && !!value.trim() && !/[\r\n]/.test(value);
  const { fieldType, options } = attrs;
  if (!isUuid(attrs.id) || !singleLine(attrs.name) || !Array.isArray(options)) return false;
  if (fieldType === 'select') {
    return options.length > 0 && options.every(singleLine) && new Set(options).size === options.length;
  }
  return (fieldType === 'text' || fieldType === 'multiline') && options.length === 0;
}

/** The first occurrence determines field order and the definition for a given name. */
export function getTemplateVariables(doc?: JSONContent): TemplateVariable[] {
  const byName = new Map<string, TemplateVariable>();
  const namesById = new Map<string, string>();
  function visit(node: JSONContent) {
    if (node?.type === 'templateVariable') {
      const attrs = node.attrs ?? {};
      if (!isTemplateVariable(attrs)) throw new Error('Invalid template variable');
      const key = templateVariableNameKey(attrs.name);
      if (namesById.has(attrs.id) && namesById.get(attrs.id) !== key) {
        throw new Error('Conflicting template variable names');
      }
      namesById.set(attrs.id, key);
      if (!byName.has(key)) {
        const { id, name, fieldType, options } = attrs;
        byName.set(key, { id, name, fieldType, options });
      }
    } else if (Array.isArray(node?.content)) {
      node.content.forEach(visit);
    }
  }
  if (doc) visit(doc);
  return Array.from(byName.values());
}

export const TemplateVariableNode = Node.create({
  name: 'templateVariable',
  inline: true,
  group: 'inline',
  atom: true,

  addAttributes() {
    return {
      id: { default: null, rendered: false },
      name: { default: '', rendered: false, validate: 'string' },
      fieldType: { default: 'text', rendered: false, validate: 'string' },
      options: { default: [], rendered: false },
    };
  },

  parseHTML() {
    return [{
      tag: 'span[data-template-variable]',
      getAttrs: (element) => {
        try {
          const attrs = JSON.parse(element.getAttribute('data-template-variable'));
          return attrs && isTemplateVariable(attrs) ? attrs : false;
        } catch {
          return false;
        }
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { id, name, fieldType, options } = node.attrs;
    return ['span', {
      ...HTMLAttributes,
      'data-template-variable': JSON.stringify({ id, name, fieldType, options }),
    }, name];
  },

  renderText({ node }) {
    return node.attrs.name;
  },
});
