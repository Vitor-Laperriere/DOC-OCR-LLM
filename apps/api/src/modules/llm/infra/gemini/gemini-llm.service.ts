import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import type { LlmPort, LlmMessage } from '../../domain/llm.port';

function toTranscript(messages: LlmMessage[]) {
  // Você já está montando contexto + histórico no AskDocumentUseCase.
  // Aqui apenas transformamos em um “roteiro” bem estável para LLM.
  return messages
    .map((m) => `${m.role.toUpperCase()}:\n${m.content}`)
    .join('\n\n---\n\n');
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
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY não configurada no backend.',
      );
    }

    const contents =
      `INSTRUCTIONS:\n${input.instructions}\n\n` +
      `CONVERSATION:\n${toTranscript(input.messages)}\n`;

    try {
      // Quickstart oficial: ai.models.generateContent({ model, contents })
      const response = await this.ai.models.generateContent({
        model,
        contents,
      });

      return { answer: response.text ?? '' };
    } catch (e: any) {
      // padroniza erro para a API não “explodir” com stack gigante no client
      throw new ServiceUnavailableException(
        e?.message ?? 'Falha ao chamar Gemini API',
      );
    }
  }
}
