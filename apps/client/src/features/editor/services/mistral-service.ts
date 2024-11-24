import { Mistral } from '@mistralai/mistralai';

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      content?: string;
      role?: string;
      function_call?: any;
    };
    finish_reason: string | null;
  }>;
}

class MistralService {
  private client: Mistral | null = null;

  constructor() {
    // Access the environment variable directly from import.meta.env
    const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
    console.log('API Key status:', apiKey ? 'Present' : 'Missing');
    
    if (!apiKey) {
      console.warn('Mistral API key not found. Autocomplete will not work.');
      return;
    }
    this.client = new Mistral({ apiKey });
  }

  async getCompletion(prompt: string): Promise<string> {
    if (!this.client) {
      throw new Error('Mistral client not initialized');
    }

    try {
      const chatResponse = await this.client.chat.complete({
        model: "mistral-small-latest",
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Provide direct answers without any additional comments or explanations. Format your response in markdown.' },
          { role: 'user', content: prompt }
        ]
      });
      
      const content = chatResponse.choices[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    } catch (error) {
      console.error('Error getting completion:', error);
      throw error;
    }
  }

  async streamCompletion(prompt: string, onChunk: (text: string) => void): Promise<void> {
    if (!this.client) {
      throw new Error('Mistral client not initialized');
    }

    try {
      const stream = await this.client.chat.stream({
        model: "mistral-small-latest",
        messages: [{ role: 'user', content: prompt }],
      });

      for await (const chunk of stream) {
        const content = chunk.data?.choices[0]?.delta?.content;
        if (content && typeof content === 'string') {
          onChunk(content);
        }
      }
    } catch (error) {
      console.error('Error streaming completion:', error);
      throw error;
    }
  }
}

export const mistralService = new MistralService();
