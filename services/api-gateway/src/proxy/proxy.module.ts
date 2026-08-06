import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * ProxyModule routes requests to the appropriate microservice.
 * Reads service URLs from environment variables for cloud deployment support.
 */
@Module({})
export class ProxyModule implements NestModule {
  private formatTarget(envVarName: string, fallback: string): string {
    const val = process.env[envVarName];
    if (!val) return fallback;
    return val.startsWith('http://') || val.startsWith('https://') ? val : `http://${val}`;
  }

  configure(consumer: MiddlewareConsumer) {
    const authTarget = this.formatTarget('AUTH_SERVICE_URL', 'http://localhost:3001');
    const tenantTarget = this.formatTarget('TENANT_SERVICE_URL', 'http://localhost:3002');
    const userTarget = this.formatTarget('USER_SERVICE_URL', 'http://localhost:3003');
    const examTarget = this.formatTarget('EXAM_SERVICE_URL', 'http://localhost:3004');
    const questionTarget = this.formatTarget('QUESTION_SERVICE_URL', 'http://localhost:3005');

    // Auth Service
    consumer
      .apply(createProxyMiddleware({
        target: authTarget,
        changeOrigin: true,
        on: { error: this.handleError('/api/v1/auth') },
      }))
      .forRoutes({ path: '/api/v1/auth', method: RequestMethod.ALL },
                 { path: '/api/v1/auth/*path', method: RequestMethod.ALL });

    // Tenant Service
    consumer
      .apply(createProxyMiddleware({
        target: tenantTarget,
        changeOrigin: true,
        on: { error: this.handleError('/api/v1/tenants') },
      }))
      .forRoutes({ path: '/api/v1/tenants', method: RequestMethod.ALL },
                 { path: '/api/v1/tenants/*path', method: RequestMethod.ALL });

    // User Service
    consumer
      .apply(createProxyMiddleware({
        target: userTarget,
        changeOrigin: true,
        on: { error: this.handleError('/api/v1/users') },
      }))
      .forRoutes({ path: '/api/v1/users', method: RequestMethod.ALL },
                 { path: '/api/v1/users/*path', method: RequestMethod.ALL });

    // Exam Service
    consumer
      .apply(createProxyMiddleware({
        target: examTarget,
        changeOrigin: true,
        on: { error: this.handleError('/api/v1/exams') },
      }))
      .forRoutes({ path: '/api/v1/exams', method: RequestMethod.ALL },
                 { path: '/api/v1/exams/*path', method: RequestMethod.ALL });

    // Code Execution (also exam service)
    consumer
      .apply(createProxyMiddleware({
        target: examTarget,
        changeOrigin: true,
        on: { error: this.handleError('/api/v1/code-execution') },
      }))
      .forRoutes({ path: '/api/v1/code-execution', method: RequestMethod.ALL },
                 { path: '/api/v1/code-execution/*path', method: RequestMethod.ALL });

    // Question Bank Service
    consumer
      .apply(createProxyMiddleware({
        target: questionTarget,
        changeOrigin: true,
        on: { error: this.handleError('/api/v1/questions') },
      }))
      .forRoutes({ path: '/api/v1/questions', method: RequestMethod.ALL },
                 { path: '/api/v1/questions/*path', method: RequestMethod.ALL });
  }

  private handleError(servicePath: string) {
    return (err: any, req: any, res: any) => {
      console.error(`Proxy error for ${servicePath}:`, err.message);
      if (!res.headersSent) {
        res.status(502).json({
          success: false,
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: `Service at ${servicePath} is currently unavailable`,
          },
          timestamp: new Date().toISOString(),
        });
      }
    };
  }
}
