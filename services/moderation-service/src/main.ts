// Must run before anything it instruments.
import './observability/tracing';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { tracingEnabled } from './observability/tracing';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import * as Sentry from '@sentry/node';
import { SentryExceptionFilter } from './filters/sentry-exception.filter';
import { assertRequiredSecrets, loadPublicKeys, corsOrigins, isProduction } from './common/security';

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
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Moderation Service')
    .setDescription('The Marad Moderation and Admin API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (!isProduction()) {
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3008);
}
bootstrap();
