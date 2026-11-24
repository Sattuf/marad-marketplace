// Must run before anything it instruments.
import './observability/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { tracingEnabled } from './observability/tracing';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import * as path from 'path';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { assertRequiredSecrets, loadPublicKeys, corsOrigins, isProduction } from './common/security';

async function bootstrap() {
  assertRequiredSecrets('INTERNAL_SECRET');
  loadPublicKeys(); // fails at boot on a missing or malformed JWT_PUBLIC_JWKS
  const app = await NestFactory.create(AppModule, { bodyParser: false, bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  
  // Error reporting only when configured; OpenTelemetry owns tracing (tracing.ts).
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, skipOpenTelemetrySetup: tracingEnabled });
  }
  app.useGlobalFilters(new SentryExceptionFilter());
  app.enableCors({ origin: corsOrigins() });
  
  app.use('/promotions/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Locally stored images (development, no S3): see storage.service localMediaUrl.
  app.use(
    '/media/listings',
    express.static(path.join(process.cwd(), 'tmp', 'listings'), { index: false, fallthrough: false, maxAge: '7d', immutable: true }),
  );

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Listings Service')
    .setDescription('The listings service API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (!isProduction()) {
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();

