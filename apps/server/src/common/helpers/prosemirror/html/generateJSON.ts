import { Extensions, getSchema } from '@tiptap/core';
import { DOMParser, ParseOptions } from '@tiptap/pm/model';
import { Window } from 'happy-dom';

// this function does not work as intended
// it has issues with closing tags
export function generateJSON(
  html: string,
  extensions: Extensions,
  options?: ParseOptions,
): Record<string, any> {
  const schema = getSchema(extensions);

  const window = new Window();
  const document = window.document;
  document.body.innerHTML = html;

  return DOMParser.fromSchema(schema)
    .parse(document as never, options)
    .toJSON();
}
