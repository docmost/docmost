import type { Extensions, JSONContent } from "@tiptap/core";
import type { UniqueID } from "./unique-id";

/**
 * Creates a new document with unique IDs added to the nodes. Does the same
 * thing as the UniqueID extension, but without the need to create an `Editor`
 * instance. This lets you add unique IDs to the document in the server.
 *
 * When you call it, include the `UniqueID` extension in the `extensions` array.
 * The configuration from the `UniqueID` extension will be picked up
 * automatically, including its configuration options like `types` and
 * `attributeName`.
 *
 * @see `UniqueID` extension for more information.
 *
 * @throws {Error} If the `UniqueID` extension is not found in the extensions array.
 *
 * @example
 * const doc = {
 *   type: 'doc',
 *   content: [
 *     { type: 'paragraph', content: [{ type: 'text', text: 'Hello, world!' }] }
 *   ]
 * }
 * const newDoc = addUniqueIds(doc, [StarterKit, UniqueID.configure({ types: ['paragraph', 'heading'] })])
 * console.log(newDoc)
 * // Result:
 * // {
 * //   type: 'doc',
 * //   content: [
 * //     { type: 'paragraph', content: [{ type: 'text', text: 'Hello, world!' }], id: '123' }
 * //   ]
 * // }
 *
 * @param doc - A Tiptap JSON document to add unique IDs to.
 * @param extensions - The extensions to use. Must include the `UniqueID` extension.
 * @returns The updated Tiptap JSON document, with the unique IDs added to the nodes.
 */
export function addUniqueIdsToDoc(
  doc: JSONContent,
  extensions: Extensions,
): JSONContent {
  // Find the UniqueID extension in the extensions array. If it's not found, throw an error.
  const uniqueIDExtension = extensions.find(
    (ext) => ext.name === "uniqueID",
  ) as typeof UniqueID | undefined;
  if (!uniqueIDExtension) {
    throw new Error("UniqueID extension not found in the extensions array");
  }
  const { types, attributeName } = uniqueIDExtension.options;
  // Our generateID takes no context, and a JSON node has no document position
  const generateID = uniqueIDExtension.options.generateID as () => string;

  // A single walk over the JSON: a transaction step per node keeps a copy of the document for every step
  const addIds = (node: JSONContent): JSONContent => {
    const result = { ...node };

    if (types.includes(node.type) && !node.attrs?.[attributeName]) {
      result.attrs = { ...node.attrs, [attributeName]: generateID() };
    }

    if (node.content) {
      result.content = node.content.map(addIds);
    }

    return result;
  };

  return addIds(doc);
}
