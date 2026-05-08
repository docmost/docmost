import { Injectable, Logger } from '@nestjs/common';

interface MinimaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class MinimaxService {
  private readonly logger = new Logger(MinimaxService.name);
  private readonly baseUrl = 'https://api.minimax.chat/v1';

  async chatStream(
    messages: MinimaxMessage[],
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (err: string) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const apiKey = process.env.MINIMAX_API_KEY;
    const groupId = process.env.MINIMAX_GROUP_ID;

    if (!apiKey) {
      onError('MINIMAX_API_KEY not configured');
      return;
    }

    if (!groupId) {
      onError('MINIMAX_GROUP_ID not configured');
      return;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/chat/completions?GroupId=${groupId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'minimax-latest',
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 4096,
          }),
          signal,
        },
      );

      if (!response.ok) {
        const body = await response.text();
        onError(`Minimax API error ${response.status}: ${body}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6);
          if (data === '[DONE]') {
            onDone();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              onChunk(delta);
            }
          } catch {
            // skip
          }
        }
      }

      onDone();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        onError(err.message);
      }
    }
  }
}
