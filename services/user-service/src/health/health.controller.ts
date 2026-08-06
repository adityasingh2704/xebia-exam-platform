import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    const dbHealthy = await this.prisma.isHealthy();
    return {
      status: dbHealthy ? 'ok' : 'degraded',
      service: 'user-service',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      checks: { database: dbHealthy ? 'ok' : 'down' },
    };
  }
}
