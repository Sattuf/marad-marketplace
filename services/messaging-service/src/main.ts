// Must run before anything it instruments.
import './observability/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { tracingEnabled } from './observability/tracing';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { serveMessageImage } from './messaging/storage.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { assertRequiredSecrets, loadPublicKeys, corsOrigins, isProduction } from './common/security';
import { RedisIoAdapter } from './redis/redis-io.adapter';

async function bootstrap() {
  assertRequiredSecrets('INTERNAL_SECRET');
  loadPublicKeys(); // fails at boot on a missing or malformed JWT_PUBLIC_JWKS
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  
  // Error reporting only when configured; OpenTelemetry owns tracing (tracing.ts).
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, skipOpenTelemetrySetup: tracingEnabled });
  }
  // Share Socket.IO rooms across replicas (set SOCKET_REDIS_ADAPTER=false to run standalone).
  if (process.env.SOCKET_REDIS_ADAPTER !== 'false') {
    const ioAdapter = new RedisIoAdapter(app);
    await ioAdapter.connectToRedis();
    app.useWebSocketAdapter(ioAdapter);
  }
  app.useGlobalFilters(new SentryExceptionFilter());
  // Strip unknown properties and enforce DTO constraints (class-validator) on every route.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: corsOrigins() });
  // Chat images stored locally: see storage.service localMediaUrl.
  // Signed, expiring URLs only (storage.service signMessageImageUrl): chat images are private.
  app.use('/media/messages', serveMessageImage);

  const config = new DocumentBuilder()
    .setTitle('Messaging Service')
    .setDescription('خدمة المحادثات الفورية — Real-time Messaging Service')
    .setVersion('0.1.0')
    .build();
  if (!isProduction()) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3004);
  const logger = new Logger('MessagingService');
  logger.log(`Messaging Service is running on port ${process.env.PORT ?? 3004}`);
}
bootstrap();
