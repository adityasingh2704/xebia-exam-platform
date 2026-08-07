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
        error: { code: 'SERVICE_UNAVAILABLE', message: `${serviceName} is currently starting up (free tier cold-start). Please retry in a few seconds.` },
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Dual-path proxy rules: supports both /api/v1/... and short /... routes with 60s cold-start timeout
  const commonProxyOptions = {
    changeOrigin: true,
    timeout: 60000,
    proxyTimeout: 60000,
  };

  expressApp.use(
    createProxyMiddleware({
      ...commonProxyOptions,
      target: authTarget,
      pathFilter: (path) => path.startsWith('/api/v1/auth') || path.startsWith('/auth'),
      pathRewrite: (path) => (path.startsWith('/api/v1') ? path : `/api/v1${path}`),
      on: { error: handleError('Auth Service') },
    }),
  );

  expressApp.use(
    createProxyMiddleware({
      ...commonProxyOptions,
      target: tenantTarget,
      pathFilter: (path) => path.startsWith('/api/v1/tenants') || path.startsWith('/tenants'),
      pathRewrite: (path) => (path.startsWith('/api/v1') ? path : `/api/v1${path}`),
      on: { error: handleError('Tenant Service') },
    }),
  );

  expressApp.use(
    createProxyMiddleware({
      ...commonProxyOptions,
      target: userTarget,
      pathFilter: (path) => path.startsWith('/api/v1/users') || path.startsWith('/users'),
      pathRewrite: (path) => (path.startsWith('/api/v1') ? path : `/api/v1${path}`),
      on: { error: handleError('User Service') },
    }),
  );

  expressApp.use(
    createProxyMiddleware({
      ...commonProxyOptions,
      target: examTarget,
      pathFilter: (path) =>
        path.startsWith('/api/v1/exams') ||
        path.startsWith('/exams') ||
        path.startsWith('/api/v1/code-execution') ||
        path.startsWith('/code-execution'),
      pathRewrite: (path) => (path.startsWith('/api/v1') ? path : `/api/v1${path}`),
      on: { error: handleError('Exam Service') },
    }),
  );

  expressApp.use(
    createProxyMiddleware({
      ...commonProxyOptions,
      target: questionTarget,
      pathFilter: (path) => path.startsWith('/api/v1/questions') || path.startsWith('/questions'),
      pathRewrite: (path) => (path.startsWith('/api/v1') ? path : `/api/v1${path}`),
      on: { error: handleError('Question Bank Service') },
    }),
  );

  const port = process.env.PORT || process.env.API_GATEWAY_PORT || 3006;
  await app.listen(port);
  console.log(`🚀 API Gateway running on port ${port}`);

  // Background Keep-Alive pinger every 5 minutes to prevent Render free tier spin-down
  const targets = [authTarget, tenantTarget, userTarget, examTarget, questionTarget];
  setInterval(() => {
    targets.forEach((t) => {
      const url = `${t.replace(/\/$/, '')}/api/v1/health`;
      fetch(url).catch(() => {});
    });
  }, 300000); // 5 minutes
}

bootstrap();
