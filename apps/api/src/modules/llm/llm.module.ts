import { Module } from '@nestjs/common';
import { LLM_PORT } from './domain/llm.port';
import { OpenAiLlmService } from './infra/openai/openai-llm.service';

@Module({
  providers: [
    OpenAiLlmService,
    { provide: LLM_PORT, useExisting: OpenAiLlmService },
  ],
  exports: [LLM_PORT],
})
export class LlmModule {}
