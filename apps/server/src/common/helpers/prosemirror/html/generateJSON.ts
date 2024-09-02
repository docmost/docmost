import { Extensions, getSchema } from '@tiptap/core';
import { DOMParser, ParseOptions } from '@tiptap/pm/model';
import { Window, DOMParser as HappyDomParser } from 'happy-dom';

export function generateJSON(
  html: string,
  extensions: Extensions,
  options?: ParseOptions,
): Record<string, any> {
  const schema = getSchema(extensions);

  const window = new Window();
  const dom = new HappyDomParser().parseFromString(html, 'text/html').body;

  // @ts-ignore
  return DOMParser.fromSchema(schema).parse(dom, options).toJSON();
}
