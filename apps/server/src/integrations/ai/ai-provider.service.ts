import { BadRequestException, Injectable } from '@nestjs/common';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import { EnvironmentService } from '../environment/environment.service';

@Injectable()
export class AiProviderService {
  constructor(private readonly environmentService: EnvironmentService) {}

  isConfigured(): boolean {
    return Boolean(
      this.environmentService.getAiDriver() &&
        this.environmentService.getAiCompletionModel(),
    );
  }

  /**
   * Returns a Vercel AI SDK language model for the configured AI_DRIVER.
   */
  completionModel(): LanguageModel {
    const driver = (this.environmentService.getAiDriver() || '').toLowerCase();
    const model = this.environmentService.getAiCompletionModel();

    if (!driver || !model) {
      throw new BadRequestException('AI is not configured on this server');
    }

    switch (driver) {
      case 'openai': {
        const openai = createOpenAI({
          apiKey: this.environmentService.getOpenAiApiKey(),
          baseURL: this.environmentService.getOpenAiApiUrl() || undefined,
        });
        return openai(model);
      }
      case 'openai-compatible': {
        const provider = createOpenAICompatible({
          name: 'docmost-openai-compatible',
          apiKey: this.environmentService.getOpenAiApiKey(),
          baseURL: this.environmentService.getOpenAiApiUrl(),
        });
        return provider(model);
      }
      case 'gemini': {
        const google = createGoogleGenerativeAI({
          apiKey: this.environmentService.getGeminiApiKey(),
        });
        return google(model);
      }
      case 'ollama': {
        // ai-sdk-ollama is ESM (type: module) with a CJS condition; load via
        // require so it resolves under the server's CommonJS build.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createOllama } = require('ai-sdk-ollama');
        const ollama = createOllama({
          baseURL: this.environmentService.getOllamaApiUrl(),
        });
        return ollama(model);
      }
      default:
        throw new BadRequestException(`Unsupported AI_DRIVER: ${driver}`);
    }
  }
}
