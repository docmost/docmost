import { AlignmentType, convertInchesToTwip, ILevelsOptions, LevelFormat } from 'docx';
import { INumbering } from './types';

function basicIndentStyle(indent: number): Pick<ILevelsOptions, 'style' | 'alignment'> {
  return {
    alignment: AlignmentType.START,
    style: {
      paragraph: {
        indent: { left: convertInchesToTwip(indent), hanging: convertInchesToTwip(0.18) },
      },
    },
  };
}

const numberFormats = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];

const bulletSymbols = ['●', '○', '■'];

const markers = {
  numbered: (level: number, firstFormat: number) => ({
    format: numberFormats[(firstFormat + level) % 3],
    text: `%${level + 1}.`,
  }),
  bullets: (level: number) => ({ format: LevelFormat.BULLET, text: bulletSymbols[level % 3] }),
  // task items start with their own checkbox
  tasks: () => ({ format: LevelFormat.NONE, text: '' }),
};

export type NumberingStyles = keyof typeof markers;

// Bullets change with the level. Number formats cycle so that `level` gets the format the
// editor gives a numbered list inside `numberedDepth` other numbered lists.
export function createNumbering(
  reference: string,
  style: NumberingStyles,
  level = 0,
  numberedDepth = 0,
): INumbering {
  const firstFormat = (((numberedDepth - level) % 3) + 3) % 3;
  return {
    reference,
    // Word lists have nine levels
    levels: Array.from({ length: 9 }, (_, i) => ({
      level: i,
      ...markers[style](i, firstFormat),
      ...basicIndentStyle((i + 1) / 2),
    })),
  };
}
