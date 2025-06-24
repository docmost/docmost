import { Extension, textInputRule } from '@tiptap/core'

export const ExtraLigatures = Extension.create({
  name: 'extraLigatures',

  addInputRules() {

    return [
      textInputRule({
        find: /=>$/,
        replace: '⇒',
      }),
      textInputRule({
        find: />=$/,
        replace: '≥',
      }),
      textInputRule({
        find: /<=$/,
        replace: '≤',
      }),
    ]
  },
})
