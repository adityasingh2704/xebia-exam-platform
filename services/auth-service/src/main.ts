import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // CORS — allow frontend on any localhost port
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile, curl, Postman)
      if (!origin) return callback(null, true);
      // Allow any localhost origin regardless of port
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        return callback(null, true);
      }
      // Allow configured frontend URL
      const allowed = process.env.FRONTEND_URL;
      if (allowed && origin === allowed) return callback(null, true);
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
  });

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Xe-Recruiters Auth Service')
    .setDescription('Identity & Authentication Service API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || process.env.AUTH_SERVICE_PORT || 3001;
  await app.listen(port);
  console.log(`🔐 Auth Service running on port ${port}`);
  console.log(`📖 API Docs: http://localhost:${port}/docs`);
}

bootstrap();
