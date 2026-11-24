/**
 * Structured JSON logs (pino), identical copy in every NestJS service.
 * One line per request with method, path, status, duration, the gateway's X-Request-ID and,
 * when tracing is on, the OpenTelemetry trace id — so a log line leads straight to its trace.
 */
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Pretty output only when explicitly asked for (pino-pretty is not installed in images).
        transport: process.env.LOG_PRETTY === 'true' ? { target: 'pino-pretty' } : undefined,
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? undefined,
        customProps: (req) => ({ requestId: req.headers['x-request-id'] }),
        autoLogging: { ignore: (req) => /^\/(health|metrics)\b/.test(req.url ?? '') },
        // Never log credentials.
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-internal-secret"]'],
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  ],
})
export class LoggingModule {}
