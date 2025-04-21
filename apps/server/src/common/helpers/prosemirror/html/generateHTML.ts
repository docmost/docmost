import { Extensions, getSchema, JSONContent } from '@tiptap/core';
import { DOMSerializer, Node } from '@tiptap/pm/model';
import { Window } from 'happy-dom';

export function generateHTML(doc: JSONContent, extensions: Extensions): string {
  const schema = getSchema(extensions);
  const contentNode = Node.fromJSON(schema, doc);

  const window = new Window();

  const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
    contentNode.content,
    {
      document: window.document as unknown as Document,
    },
  );

  const serializer = new window.XMLSerializer();
  // @ts-ignore
  return serializer.serializeToString(fragment as unknown as Node);
}
