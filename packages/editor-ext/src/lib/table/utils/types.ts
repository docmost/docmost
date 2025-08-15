import type {
  Node,
  ResolvedPos,
} from '@tiptap/pm/model'

export type CellPos = {
  pos: number
  start: number
  depth: number
  node: Node
}

export type CellSelectionRange = {
  $anchor: ResolvedPos
  $head: ResolvedPos
  // an array of column/row indexes
  indexes: number[]
}
