import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { mistralService } from '../services/mistral-service';

export const MistralAutocomplete = Extension.create({
  name: 'mistralAutocomplete',

  addProseMirrorPlugins() {
    let timeout: NodeJS.Timeout;
    let activeCompletion: string | null = null;
    
    return [
      new Plugin({
        key: new PluginKey('mistralAutocomplete'),
        
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set) {
            // Adjust decorations based on document changes
            set = set.map(tr.mapping, tr.doc);
            return set;
          },
        },

        props: {
          handleKeyDown(view, event) {
            // Clear any existing timeout
            if (timeout) {
              clearTimeout(timeout);
            }

            // If we have an active completion and user presses Tab
            if (activeCompletion && event.key === 'Tab') {
              event.preventDefault();
              
              if (activeCompletion) {
                const { state } = view;
                const { tr } = state;
                const pos = state.selection.from;
                
                view.dispatch(tr.insertText(activeCompletion));
                activeCompletion = null;
                return true;
              }
            }

            // Set a new timeout for getting completion
            timeout = setTimeout(async () => {
              const { state } = view;
              const { doc, selection } = state;
              const { from } = selection;

              // Get the current paragraph's text
              const currentNode = doc.nodeAt(from);
              if (!currentNode) return;

              const currentText = currentNode.textContent;
              
              try {
                // Get completion from Mistral
                const completion = await mistralService.getCompletion(currentText);
                
                // Store the completion
                activeCompletion = completion;
                
                // Show completion as a decoration
                const decorations = DecorationSet.create(doc, [
                  Decoration.widget(from, () => {
                    const span = document.createElement('span');
                    span.className = 'mistral-completion';
                    span.style.opacity = '0.5';
                    span.textContent = completion;
                    return span;
                  }),
                ]);

                view.dispatch(view.state.tr.setMeta('mistralAutocomplete', decorations));
              } catch (error) {
                console.error('Error getting completion:', error);
              }
            }, 500); // Wait 500ms after last keystroke

            return false;
          },
        },

        view(editorView) {
          return {
            destroy() {
              if (timeout) {
                clearTimeout(timeout);
              }
            },
          };
        },
      }),
    ];
  },
});
