export const AI_ACTION_IDS = [
  'improve_writing',
  'fix_spelling_grammar',
  'make_shorter',
  'make_longer',
  'simplify',
  'change_tone',
  'summarize',
  'explain',
  'continue_writing',
  'translate',
  'custom',
] as const;

export type AiActionId = (typeof AI_ACTION_IDS)[number];

const SYSTEM =
  'You are a writing assistant embedded in a wiki editor. ' +
  'Return only the resulting text with no preamble, explanations, or markdown code fences. ' +
  'Preserve the original language unless explicitly asked to translate.';

/**
 * Builds the system + user prompt for an Ask AI action over the selected text.
 * `prompt` carries the tone (change_tone), target language (translate), or the
 * free-form instruction (custom).
 */
export function buildPrompt(
  action: AiActionId | undefined,
  content: string,
  prompt?: string,
): { system: string; user: string } {
  switch (action) {
    case 'improve_writing':
      return {
        system: SYSTEM,
        user: `Improve the writing of the following text while preserving its meaning:\n\n${content}`,
      };
    case 'fix_spelling_grammar':
      return {
        system: SYSTEM,
        user: `Fix the spelling and grammar of the following text:\n\n${content}`,
      };
    case 'make_shorter':
      return {
        system: SYSTEM,
        user: `Make the following text shorter while keeping the key points:\n\n${content}`,
      };
    case 'make_longer':
      return {
        system: SYSTEM,
        user: `Expand the following text with more detail:\n\n${content}`,
      };
    case 'simplify':
      return {
        system: SYSTEM,
        user: `Simplify the following text so it is easier to read:\n\n${content}`,
      };
    case 'summarize':
      return {
        system: SYSTEM,
        user: `Summarize the following text:\n\n${content}`,
      };
    case 'explain':
      return {
        system: SYSTEM,
        user: `Explain the following text:\n\n${content}`,
      };
    case 'continue_writing':
      return {
        system: SYSTEM,
        user: `Continue writing naturally from where the following text ends:\n\n${content}`,
      };
    case 'change_tone':
      return {
        system: SYSTEM,
        user: `Rewrite the following text in a ${prompt || 'professional'} tone:\n\n${content}`,
      };
    case 'translate':
      return {
        system: SYSTEM,
        user: `Translate the following text into ${prompt || 'English'}. Return only the translation:\n\n${content}`,
      };
    case 'custom':
      return {
        system: SYSTEM,
        user: `${prompt || 'Edit the following text'}:\n\n${content}`,
      };
    default:
      // no recognized action: treat prompt as a custom instruction if present
      return {
        system: SYSTEM,
        user: prompt ? `${prompt}:\n\n${content}` : content,
      };
  }
}
