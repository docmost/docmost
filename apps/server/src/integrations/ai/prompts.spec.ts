import { AI_ACTION_IDS, buildPrompt } from './prompts';

describe('buildPrompt', () => {
  const content = 'hello world';

  it('builds a prompt for each known action containing the content', () => {
    for (const action of AI_ACTION_IDS) {
      const { system, user } = buildPrompt(action, content, 'Friendly');
      expect(system).toContain('writing assistant');
      expect(user).toContain(content);
    }
  });

  it('uses the prompt as tone for change_tone', () => {
    const { user } = buildPrompt('change_tone', content, 'Casual');
    expect(user.toLowerCase()).toContain('casual tone');
  });

  it('uses the prompt as target language for translate', () => {
    const { user } = buildPrompt('translate', content, 'Japanese');
    expect(user).toContain('Japanese');
  });

  it('uses the prompt as instruction for custom', () => {
    const { user } = buildPrompt('custom', content, 'Make it a haiku');
    expect(user).toContain('Make it a haiku');
    expect(user).toContain(content);
  });

  it('falls back to custom instruction when no action but a prompt is given', () => {
    const { user } = buildPrompt(undefined, content, 'Bulletize this');
    expect(user).toContain('Bulletize this');
    expect(user).toContain(content);
  });

  it('returns raw content when neither action nor prompt is given', () => {
    const { user } = buildPrompt(undefined, content);
    expect(user).toBe(content);
  });
});
