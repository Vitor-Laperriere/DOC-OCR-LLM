import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import type { LlmPort, LlmMessage } from '../../domain/llm.port';

@Injectable()
export class OpenAiLlmService implements LlmPort {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async answerWithContext(input: {
    instructions: string;
    messages: LlmMessage[];
  }): Promise<{ answer: string }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException('OPENAI_API_KEY não configurada.');
    }

    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 400);

    try {
      const response = await this.client.responses.create({
        model,
        instructions: input.instructions,
        input: input.messages as any,
        max_output_tokens: maxOutputTokens,
      });

      return { answer: response.output_text ?? '' };
    } catch (e: any) {
      // 429 insuficiente_quota é comum quando não há crédito/billing.
      throw new ServiceUnavailableException(
        e?.message ??
          'Falha ao chamar OpenAI (verifique quota/billing/credenciais).',
      );
    }
  }
}
