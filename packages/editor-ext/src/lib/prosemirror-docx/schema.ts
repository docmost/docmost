import { HeadingLevel, ShadingType } from 'docx';
import {
  DocxSerializer,
  MarkSerializer,
  NodeSerializer,
  DocxSerializerAsync,
  NodeSerializerAsync,
} from './serializer';
import { getLatexFromNode } from './utils';

export const defaultNodes: NodeSerializer = {
  text(state, node) {
    state.text(node.text ?? '');
  },
  paragraph(state, node) {
    state.renderInline(node);
    state.closeBlock(node);
  },
  heading(state, node) {
    state.renderInline(node);
    const heading = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ][node.attrs.level - 1];
    state.closeBlock(node, { heading });
  },
  blockquote(state, node) {
    state.renderContent(node, { style: 'IntenseQuote' });
  },
  code_block(state, node) {
    // TODO: something for code
    state.renderContent(node);
    state.closeBlock(node);
  },
  horizontal_rule(state, node) {
    // Kinda hacky, but this works to insert two paragraphs, the first with a break
    state.closeBlock(node, { thematicBreak: true });
    state.closeBlock(node);
  },
  hard_break(state) {
    state.addRunOptions({ break: 1 });
  },
  ordered_list(state, node) {
    state.renderList(node, 'numbered');
  },
  bullet_list(state, node) {
    state.renderList(node, 'bullets');
  },
  list_item(state, node) {
    state.renderListItem(node);
  },
  // Presentational
  image(state, node) {
    const { src } = node.attrs;
    state.image(src);
    state.closeBlock(node);
  },
  // Technical
  math(state, node) {
    state.math(getLatexFromNode(node), { inline: true });
  },
  equation(state, node) {
    const { id, numbered } = node.attrs;
    state.math(getLatexFromNode(node), { inline: false, numbered, id });
    state.closeBlock(node);
  },
  table(state, node) {
    state.table(node);
  },
};

export const defaultAsyncNodes: NodeSerializerAsync = {
  text(state, node) {
    state.text(node.text ?? '');
  },
  async paragraph(state, node) {
    await state.renderInline(node);
    state.closeBlock(node);
  },
  async heading(state, node) {
    await state.renderInline(node);
    const heading = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
      HeadingLevel.HEADING_6,
    ][node.attrs.level - 1];
    state.closeBlock(node, { heading });
  },
  blockquote(state, node) {
    state.renderContent(node, { style: 'IntenseQuote' });
  },
  code_block(state, node) {
    // TODO: something for code
    state.renderContent(node);
    state.closeBlock(node);
  },
  horizontal_rule(state, node) {
    // Kinda hacky, but this works to insert two paragraphs, the first with a break
    state.closeBlock(node, { thematicBreak: true });
    state.closeBlock(node);
  },
  hard_break(state) {
    state.addRunOptions({ break: 1 });
  },
  async ordered_list(state, node) {
    await state.renderList(node, 'numbered');
  },
  async bullet_list(state, node) {
    await state.renderList(node, 'bullets');
  },
  async list_item(state, node) {
    await state.renderListItem(node);
  },
  // Presentational
  async image(state, node) {
    const { src } = node.attrs;
    await state.image(src);
    state.closeBlock(node);
  },
  // Technical
  math(state, node) {
    state.math(getLatexFromNode(node), { inline: true });
  },
  equation(state, node) {
    const { id, numbered } = node.attrs;
    state.math(getLatexFromNode(node), { inline: false, numbered, id });
    state.closeBlock(node);
  },
  async table(state, node) {
    await state.table(node);
  },
};

export const defaultMarks: MarkSerializer = {
  em() {
    return { italics: true };
  },
  strong() {
    return { bold: true };
  },
  italic() {
    return { italics: true };
  },
  bold() {
    return { bold: true };
  },
  link() {
    // Note, this is handled specifically in the serializer
    // Word treats links more like a Node rather than a mark
    return {};
  },
  code() {
    return {
      font: {
        name: 'Monospace',
      },
      color: '000000',
      shading: {
        type: ShadingType.SOLID,
        color: 'D2D3D2',
        fill: 'D2D3D2',
      },
    };
  },
  abbr() {
    // TODO: abbreviation
    return {};
  },
  subscript() {
    return { subScript: true };
  },
  superscript() {
    return { superScript: true };
  },
  strikethrough() {
    // doubleStrike!
    return { strike: true };
  },
  underline() {
    return {
      underline: {},
    };
  },
  smallcaps() {
    return { smallCaps: true };
  },
  allcaps() {
    return { allCaps: true };
  },
};

export const defaultDocxSerializer = new DocxSerializer(defaultNodes, defaultMarks);
export const defaultDocxSerializerAsync = new DocxSerializerAsync(defaultAsyncNodes, defaultMarks);
