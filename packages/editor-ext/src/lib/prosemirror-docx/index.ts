// MIT - https://github.com/curvenote/prosemirror-docx/
export type { SectionConfig, SerializationState } from './types';
export type {
  MarkSerializer,
  NodeSerializer,
  NodeSerializerAsync,
  Options,
  OptionsAsync,
} from './serializer';

export {
  DocxSerializerStateAsync,
  DocxSerializerAsync,
  DocxSerializerState,
  DocxSerializer,
  MAX_IMAGE_WIDTH,
} from './serializer';
export {
  defaultAsyncNodes,
  defaultMarks,
  pageNodeToDocxBuffer,
  type DocxImageResolver,
} from './schema';
export { writeDocx, createDocFromState, buildDoc } from './utils';
