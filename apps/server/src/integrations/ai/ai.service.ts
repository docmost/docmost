import { Injectable } from '@nestjs/common';
import { generateText, streamText } from 'ai';
import { AiProviderService } from './ai-provider.service';
import { AiActionId, buildPrompt } from './prompts';

@Injectable()
export class AiService {
  constructor(private readonly aiProviderService: AiProviderService) {}

  isConfigured(): boolean {
    return this.aiProviderService.isConfigured();
  }

  async generate(action: string | undefined, content: string, prompt?: string) {
    const model = this.aiProviderService.completionModel();
    const { system, user } = buildPrompt(action as AiActionId, content, prompt);
    const { text, usage } = await generateText({ model, system, prompt: user });
    return {
      content: text,
      usage: {
        promptTokens: usage?.inputTokens ?? 0,
        completionTokens: usage?.outputTokens ?? 0,
        totalTokens: usage?.totalTokens ?? 0,
      },
    };
  }

  async *streamGenerate(
    action: string | undefined,
    content: string,
    prompt?: string,
  ): AsyncGenerator<string> {
    const model = this.aiProviderService.completionModel();
    const { system, user } = buildPrompt(action as AiActionId, content, prompt);
    const result = streamText({ model, system, prompt: user });
    for await (const delta of result.textStream) {
      yield delta;
    }
  }
}
