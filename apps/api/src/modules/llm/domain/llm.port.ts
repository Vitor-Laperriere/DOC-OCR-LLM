export const LLM_PORT = 'LLM_PORT';

export type LlmMessage = { role: 'user' | 'assistant'; content: string };

export interface LlmPort {
  answerWithContext(input: {
    instructions: string;
    messages: LlmMessage[];
  }): Promise<{ answer: string }>;
}
