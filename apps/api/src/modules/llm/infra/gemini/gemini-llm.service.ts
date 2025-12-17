import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { LlmPort, LlmMessage } from '../../domain/llm.port';
import { retryWithBackoff } from '../retry';

function toTranscript(messages: LlmMessage[]) {
  return messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join('\n\n---\n\n');
}

function isOverloadedGeminiError(e: any): boolean {
  const msg = String(e?.message ?? '');
  const code = e?.status ?? e?.code;

  // padrões comuns:
  // - status 503
  // - "UNAVAILABLE"
  // - "overloaded"
  // - payload REST: error.status = "UNAVAILABLE"
  if (code === 503) return true;
  if (msg.includes('UNAVAILABLE')) return true;
  if (msg.toLowerCase().includes('overloaded')) return true;

  const apiStatus = e?.error?.status;
  if (apiStatus === 'UNAVAILABLE') return true;

  return false;
}

@Injectable()
export class GeminiLlmService implements LlmPort {
  private ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  async answerWithContext(input: {
    instructions: string;
    messages: LlmMessage[];
  }): Promise<{ answer: string }> {
    const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

    if (!process.env.GEMINI_API_KEY) {
      throw new ServiceUnavailableException('GEMINI_API_KEY não configurada no backend.');
    }

    const contents =
      `INSTRUCTIONS:\n${input.instructions}\n\n` +
      `CONVERSATION:\n${toTranscript(input.messages)}\n`;

    try {
      const response = await retryWithBackoff(
        async () => {
          const r = await this.ai.models.generateContent({ model, contents });
          return r;
        },
        { retries: 3, baseDelayMs: 700, maxDelayMs: 3000 },
      );

      return { answer: response.text ?? '' };
    } catch (e: any) {
      // Se for overload/transiente, devolve 503 amigável
      if (isOverloadedGeminiError(e)) {
        throw new ServiceUnavailableException(
          'O Gemini está temporariamente indisponível (sob carga). Tente novamente em alguns segundos.',
        );
      }

      // Outras falhas (chave inválida etc.)
      throw new ServiceUnavailableException(e?.message ?? 'Falha ao chamar Gemini API');
    }
  }
}
