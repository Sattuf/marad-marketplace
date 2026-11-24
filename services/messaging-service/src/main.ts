import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import * as express from 'express';
import { StorageService } from './messaging/storage.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { assertRequiredSecrets, corsOrigins, isProduction } from './common/security';
import { RedisIoAdapter } from './redis/redis-io.adapter';

async function bootstrap() {
  assertRequiredSecrets('JWT_ACCESS_SECRET', 'INTERNAL_SECRET');
  const app = await NestFactory.create(AppModule);
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
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
  app.use(
    '/media/messages',
    express.static(StorageService.uploadDir, { index: false, fallthrough: false, maxAge: '7d', immutable: true }),
  );

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
