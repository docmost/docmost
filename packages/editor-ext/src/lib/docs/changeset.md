# prosemirror-changeset

This is a helper module that can turn a sequence of document changes
into a set of insertions and deletions, for example to display them in
a change-tracking interface. Such a set can be built up incrementally,
in order to do such change tracking in a halfway performant way during
live editing.

This code is licensed under an [MIT
licence](https://github.com/ProseMirror/prosemirror-changeset/blob/master/LICENSE).

## Programming interface

Insertions and deletions are represented as ‘spans’—ranges in the
document. The deleted spans refer to the original document, whereas
the inserted ones point into the current document.

It is possible to associate arbitrary data values with such spans, for
example to track the user that made the change, the timestamp at which
it was made, or the step data necessary to invert it again.

### class Change`<Data = any>`

A replaced range with metadata associated with it.

* **`fromA`**`: number`\
  The start of the range deleted/replaced in the old document.

* **`toA`**`: number`\
  The end of the range in the old document.

* **`fromB`**`: number`\
  The start of the range inserted in the new document.

* **`toB`**`: number`\
  The end of the range in the new document.

* **`deleted`**`: readonly Span[]`\
  Data associated with the deleted content. The length of these
  spans adds up to `this.toA - this.fromA`.

* **`inserted`**`: readonly Span[]`\
  Data associated with the inserted content. Length adds up to
  `this.toB - this.fromB`.

* `static `**`merge`**`<Data>(x: readonly Change[], y: readonly Change[], combine: fn(dataA: Data, dataB: Data) → Data) → readonly Change[]`\
  This merges two changesets (the end document of x should be the
  start document of y) into a single one spanning the start of x to
  the end of y.


### class Span`<Data = any>`

Stores metadata for a part of a change.

* **`length`**`: number`\
  The length of this span.

* **`data`**`: Data`\
  The data associated with this span.


### class ChangeSet`<Data = any>`

A change set tracks the changes to a document from a given point
in the past. It condenses a number of step maps down to a flat
sequence of replacements, and simplifies replacments that
partially undo themselves by comparing their content.

* **`changes`**`: readonly Change[]`\
  Replaced regions.

* **`addSteps`**`(newDoc: Node, maps: readonly StepMap[], data: Data | readonly Data[]) → ChangeSet`\
  Computes a new changeset by adding the given step maps and
  metadata (either as an array, per-map, or as a single value to be
  associated with all maps) to the current set. Will not mutate the
  old set.

  Note that due to simplification that happens after each add,
  incrementally adding steps might create a different final set
  than adding all those changes at once, since different document
  tokens might be matched during simplification depending on the
  boundaries of the current changed ranges.

* **`startDoc`**`: Node`\
  The starting document of the change set.

* **`map`**`(f: fn(range: Span) → Data) → ChangeSet`\
  Map the span's data values in the given set through a function
  and construct a new set with the resulting data.

* **`changedRange`**`(b: ChangeSet, maps?: readonly StepMap[]) → {from: number, to: number}`\
  Compare two changesets and return the range in which they are
  changed, if any. If the document changed between the maps, pass
  the maps for the steps that changed it as second argument, and
  make sure the method is called on the old set and passed the new
  set. The returned positions will be in new document coordinates.

* `static `**`create`**`<Data = any>(doc: Node, combine?: fn(dataA: Data, dataB: Data) → Data = (a, b) => a === b ? a : null as any, tokenEncoder?: TokenEncoder = DefaultEncoder) → ChangeSet`\
  Create a changeset with the given base object and configuration.

  The `combine` function is used to compare and combine metadata—it
  should return null when metadata isn't compatible, and a combined
  version for a merged range when it is.

  When given, a token encoder determines how document tokens are
  serialized and compared when diffing the content produced by
  changes. The default is to just compare nodes by name and text
  by character, ignoring marks and attributes.


* **`simplifyChanges`**`(changes: readonly Change[], doc: Node) → Change[]`\
  Simplifies a set of changes for presentation. This makes the
  assumption that having both insertions and deletions within a word
  is confusing, and, when such changes occur without a word boundary
  between them, they should be expanded to cover the entire set of
  words (in the new document) they touch. An exception is made for
  single-character replacements.


### interface TokenEncoder`<T>`

A token encoder can be passed when creating a `ChangeSet` in order
to influence the way the library runs its diffing algorithm. The
encoder determines how document tokens (such as nodes and
characters) are encoded and compared.

Note that both the encoding and the comparison may run a lot, and
doing non-trivial work in these functions could impact
performance.

* **`encodeCharacter`**`(char: number, marks: readonly Mark[]) → T`\
  Encode a given character, with the given marks applied.

* **`encodeNodeStart`**`(node: Node) → T`\
  Encode the start of a node or, if this is a leaf node, the
  entire node.

* **`encodeNodeEnd`**`(node: Node) → T`\
  Encode the end token for the given node. It is valid to encode
  every end token in the same way.

* **`compareTokens`**`(a: T, b: T) → boolean`\
  Compare the given tokens. Should return true when they count as
  equal.
