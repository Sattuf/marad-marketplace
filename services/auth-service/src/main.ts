// Must run before anything it instruments.
import './observability/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { tracingEnabled } from './observability/tracing';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { assertRequiredSecrets, loadPublicKeys, corsOrigins, isProduction } from './common/security';

async function bootstrap() {
  assertRequiredSecrets('JWT_REFRESH_SECRET', 'INTERNAL_SECRET');
  loadPublicKeys(); // fails at boot on a missing or malformed JWT_PUBLIC_JWKS
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  // Only reachable through the gateway, which sets X-Forwarded-For: trust that one hop
  // (TRUST_PROXY_HOPS=1 in docker-compose) so lockouts are keyed by the real client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '0', 10));
  
  // Error reporting only when configured; OpenTelemetry owns tracing (tracing.ts).
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, skipOpenTelemetrySetup: tracingEnabled });
  }
  app.useGlobalFilters(new SentryExceptionFilter());

  // Enable CORS
  app.enableCors({
    origin: corsOrigins(),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Setup Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Ma\'rad Al-Ashya\' - Auth Service')
    .setDescription('خدمة المصادقة والتفويض — Authentication & Authorization Service')
    .setVersion('0.1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      name: 'JWT',
      description: 'أدخل رمز الـ JWT (Access Token) هنا',
      in: 'header',
    })
    .build();
    
  if (!isProduction()) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  const logger = new Logger('AuthService');
  logger.log(`🚀 Auth Service is running on http://localhost:${port}`);
  logger.log(`📚 Swagger Docs: http://localhost:${port}/api/docs`);
}
bootstrap();
