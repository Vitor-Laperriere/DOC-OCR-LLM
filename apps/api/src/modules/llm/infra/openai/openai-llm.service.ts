import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { LlmPort, LlmMessage } from '../../domain/llm.port';

@Injectable()
export class OpenAiLlmService implements LlmPort {
  private client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  async answerWithContext(input: {
    instructions: string;
    messages: LlmMessage[];
  }): Promise<{ answer: string }> {
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 400);

    // Responses API: recommended for new projects. :contentReference[oaicite:4]{index=4}
    // Conversation state: pass alternating user/assistant messages. :contentReference[oaicite:5]{index=5}
    const response = await this.client.responses.create({
      model,
      instructions: input.instructions,
      input: input.messages,
      max_output_tokens: maxOutputTokens,
    });

    return { answer: response.output_text ?? '' };
  }
}
