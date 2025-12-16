import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LLM_PORT } from './domain/llm.port';

import { OpenAiLlmService } from './infra/openai/openai-llm.service';
import { GeminiLlmService } from './infra/gemini/gemini-llm.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [
    OpenAiLlmService,
    GeminiLlmService,
    {
      provide: LLM_PORT,
      inject: [ConfigService, OpenAiLlmService, GeminiLlmService],
      useFactory: (
        config: ConfigService,
        openai: OpenAiLlmService,
        gemini: GeminiLlmService,
      ) => {
        const provider = (config.get<string>('LLM_PROVIDER') ?? 'gemini').toLowerCase();
        if (provider === 'openai') return openai;
        if (provider === 'gemini') return gemini;
        return gemini; // fallback seguro
      },
    },
  ],
  exports: [LLM_PORT],
})
export class LlmModule {}
