import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { mistralService } from '../services/mistral-service'

let timeout: NodeJS.Timeout | null = null;
let currentSuggestion: string | null = null;

export const AIAutocomplete = Extension.create({
  name: 'ai-autocomplete',

  addProseMirrorPlugins() {
    const key = new PluginKey('ai-autocomplete')

    return [
      new Plugin({
        key,
        props: {
          handleKeyDown: (view, event) => {
            // Si Tab est pressé et qu'il y a une suggestion
            if (event.key === 'Tab' && currentSuggestion) {
              event.preventDefault();
              // Insérer la suggestion
              const { state } = view
              const { tr } = state
              const pos = state.selection.from
              tr.insertText(currentSuggestion)
              view.dispatch(tr)
              
              // Réinitialiser la suggestion
              currentSuggestion = null
              view.dispatch(view.state.tr.setMeta(key, { suggestion: null }))
              
              return true
            }
            return false
          },
          decorations: (state) => {
            const suggestion = key.getState(state)
            if (suggestion && currentSuggestion) {
              const pos = state.selection.from
              return DecorationSet.create(state.doc, [
                Decoration.inline(pos, pos, {
                  class: 'ai-suggestion',
                  nodeName: 'span',
                }, {
                  text: currentSuggestion
                })
              ])
            }
            return DecorationSet.empty
          }
        },
        state: {
          init() {
            return null
          },
          apply(tr, value) {
            const suggestion = tr.getMeta(key)?.suggestion
            if (suggestion !== undefined) {
              return suggestion
            }
            return value
          },
        },
        view: () => ({
          update: (view) => {
            if (timeout) {
              clearTimeout(timeout)
            }

            timeout = setTimeout(async () => {
              const { state } = view
              const pos = state.selection.from
              const text = state.doc.textBetween(0, pos)

              if (text.length > 10) { // Ne déclencher que si assez de contexte
                try {
                  console.log('Requesting completion for:', text)
                  const completion = await mistralService.getCompletion(text)
                  console.log('Received completion:', completion)
                  if (completion) {
                    currentSuggestion = completion
                    view.dispatch(state.tr.setMeta(key, { suggestion: completion }))
                  }
                } catch (error) {
                  console.error('Error getting AI completion:', error)
                }
              }
            }, 10000) // Délai de 10 secondes
          },
        }),
      }),
    ]
  },
})
