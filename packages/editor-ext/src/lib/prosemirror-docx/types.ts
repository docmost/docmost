import { INumberingOptions, Paragraph, ISectionOptions } from 'docx';

export type Mutable<T> = {
  -readonly [k in keyof T]: T[k];
};

export type IFootnotes = Mutable<
  Readonly<
    Record<
      string,
      {
        readonly children: readonly Paragraph[];
      }
    >
  >
>;

export type INumbering = INumberingOptions['config'][0];

export interface SectionConfig {
  properties?: ISectionOptions['properties'];
  headers?: ISectionOptions['headers'];
  footers?: ISectionOptions['footers'];
}

export interface SerializationState {
  numbering: INumberingOptions['config'];
  sections?: Array<{
    config: SectionConfig;
    children: ISectionOptions['children'];
  }>;
  children?: ISectionOptions['children'];
  footnotes?: IFootnotes;
}
