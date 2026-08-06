import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client/user';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() { super({ log: ['warn', 'error'] }); }
  async onModuleInit() { await this.$connect(); console.log('📦 User DB connected'); }
  async onModuleDestroy() { await this.$disconnect(); }
  async isHealthy(): Promise<boolean> {
    try { await this.$runCommandRaw({ ping: 1 }); return true; } catch { return false; }
  }
}
