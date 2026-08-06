import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';

/**
 * ProxyModule routes requests to the appropriate microservice.
 * Uses pathFilter and wildcard forRoutes to preserve exact URL path prefixes.
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

    consumer
      .apply(
        createProxyMiddleware({
          target: authTarget,
          changeOrigin: true,
          pathFilter: (path) => path.startsWith('/api/v1/auth'),
          on: { error: this.handleError('/api/v1/auth') },
        }),
        createProxyMiddleware({
          target: tenantTarget,
          changeOrigin: true,
          pathFilter: (path) => path.startsWith('/api/v1/tenants'),
          on: { error: this.handleError('/api/v1/tenants') },
        }),
        createProxyMiddleware({
          target: userTarget,
          changeOrigin: true,
          pathFilter: (path) => path.startsWith('/api/v1/users'),
          on: { error: this.handleError('/api/v1/users') },
        }),
        createProxyMiddleware({
          target: examTarget,
          changeOrigin: true,
          pathFilter: (path) => path.startsWith('/api/v1/exams') || path.startsWith('/api/v1/code-execution'),
          on: { error: this.handleError('/api/v1/exams') },
        }),
        createProxyMiddleware({
          target: questionTarget,
          changeOrigin: true,
          pathFilter: (path) => path.startsWith('/api/v1/questions'),
          on: { error: this.handleError('/api/v1/questions') },
        }),
      )
      .forRoutes({ path: '*', method: RequestMethod.ALL });
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
