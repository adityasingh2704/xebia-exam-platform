import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      const allowed = process.env.FRONTEND_URL;
      if (allowed && origin === allowed) return callback(null, true);
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  });

  const formatTarget = (envVarName: string, fallback: string): string => {
    const val = process.env[envVarName];
    if (!val) return fallback;
    return val.startsWith('http://') || val.startsWith('https://') ? val : `http://${val}`;
  };

  const expressApp = app.getHttpAdapter().getInstance();

  const authTarget = formatTarget('AUTH_SERVICE_URL', 'http://localhost:3001');
  const tenantTarget = formatTarget('TENANT_SERVICE_URL', 'http://localhost:3002');
  const userTarget = formatTarget('USER_SERVICE_URL', 'http://localhost:3003');
  const examTarget = formatTarget('EXAM_SERVICE_URL', 'http://localhost:3004');
  const questionTarget = formatTarget('QUESTION_SERVICE_URL', 'http://localhost:3005');

  const handleError = (serviceName: string) => (err: any, req: any, res: any) => {
    console.error(`Proxy error for ${serviceName}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: `${serviceName} is currently unavailable` },
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Explicit pathRewrite guarantees exact full API routes (/api/v1/...) are delivered to target services
  expressApp.use(
    '/api/v1/auth',
    createProxyMiddleware({
      target: authTarget,
      changeOrigin: true,
      pathRewrite: { '^/': '/api/v1/auth/' },
      on: { error: handleError('Auth Service') },
    }),
  );

  expressApp.use(
    '/api/v1/tenants',
    createProxyMiddleware({
      target: tenantTarget,
      changeOrigin: true,
      pathRewrite: { '^/': '/api/v1/tenants/' },
      on: { error: handleError('Tenant Service') },
    }),
  );

  expressApp.use(
    '/api/v1/users',
    createProxyMiddleware({
      target: userTarget,
      changeOrigin: true,
      pathRewrite: { '^/': '/api/v1/users/' },
      on: { error: handleError('User Service') },
    }),
  );

  expressApp.use(
    '/api/v1/exams',
    createProxyMiddleware({
      target: examTarget,
      changeOrigin: true,
      pathRewrite: { '^/': '/api/v1/exams/' },
      on: { error: handleError('Exam Service') },
    }),
  );

  expressApp.use(
    '/api/v1/code-execution',
    createProxyMiddleware({
      target: examTarget,
      changeOrigin: true,
      pathRewrite: { '^/': '/api/v1/code-execution/' },
      on: { error: handleError('Code Execution Service') },
    }),
  );

  expressApp.use(
    '/api/v1/questions',
    createProxyMiddleware({
      target: questionTarget,
      changeOrigin: true,
      pathRewrite: { '^/': '/api/v1/questions/' },
      on: { error: handleError('Question Bank Service') },
    }),
  );

  const port = process.env.PORT || process.env.API_GATEWAY_PORT || 3006;
  await app.listen(port);
  console.log(`🚀 API Gateway running on port ${port}`);
}

bootstrap();
