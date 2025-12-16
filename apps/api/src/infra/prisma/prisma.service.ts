import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(config: ConfigService) {
    const connectionString = config.getOrThrow<string>('DATABASE_URL');
    const adapter = new PrismaPg({ connectionString });

    // Prisma 7: precisa instanciar com opções válidas (ex.: adapter)
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }
}
