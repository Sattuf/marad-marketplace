// Must run before anything it instruments.
import './observability/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { tracingEnabled } from './observability/tracing';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';

import { ValidationPipe } from '@nestjs/common';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { assertRequiredSecrets, loadPublicKeys, corsOrigins, isProduction } from './common/security';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  assertRequiredSecrets('INTERNAL_SECRET');
  loadPublicKeys(); // fails at boot on a missing or malformed JWT_PUBLIC_JWKS
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  
  // Error reporting only when configured; OpenTelemetry owns tracing (tracing.ts).
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1, skipOpenTelemetrySetup: tracingEnabled });
  }
  app.useGlobalFilters(new SentryExceptionFilter());
  app.enableCors({ origin: corsOrigins() });
  // Locally stored avatars (development, no S3): see storage.service localMediaUrl.
  app.use(
    '/media/avatars',
    express.static(path.join(process.cwd(), 'tmp', 'avatars'), { index: false, fallthrough: false, maxAge: '7d', immutable: true }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  if (!isProduction()) {
    const config = new DocumentBuilder()
      .setTitle('Users Service')
      .setDescription('Profiles, notification settings and favorites')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(process.env.PORT ?? 3007);
}
bootstrap();
