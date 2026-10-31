// MIT - https://github.com/curvenote/prosemirror-docx/
export type { SectionConfig, SerializationState } from './types.js';
export type {
  MarkSerializer,
  NodeSerializer,
  NodeSerializerAsync,
  Options,
  OptionsAsync,
} from './serializer.js';

export {
  DocxSerializerStateAsync,
  DocxSerializerAsync,
  DocxSerializerState,
  DocxSerializer,
  MAX_IMAGE_WIDTH,
} from './serializer.js';
export {
  defaultAsyncNodes,
  defaultMarks,
  pageNodeToDocxBuffer,
  type DocxImageResolver,
} from './schema.js';
export { writeDocx, createDocFromState, buildDoc } from './utils.js';
