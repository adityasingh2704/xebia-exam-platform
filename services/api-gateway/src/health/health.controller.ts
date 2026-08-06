import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'api-gateway',
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      routes: [
        { path: '/api/v1/auth/*', target: 'http://localhost:3001' },
        { path: '/api/v1/tenants/*', target: 'http://localhost:3002' },
        { path: '/api/v1/users/*', target: 'http://localhost:3003' },
        { path: '/api/v1/exams/*', target: 'http://localhost:3004' },
        { path: '/api/v1/questions/*', target: 'http://localhost:3005' },
      ],
    };
  }
}
