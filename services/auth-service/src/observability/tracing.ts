/**
 * OpenTelemetry bootstrap — imported first in main.ts, before anything it instruments.
 * Identical copy in every NestJS service (checked by scripts/check-shared-copies.mjs).
 *
 * Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g. http://jaeger:4318). Auto-instruments
 * HTTP/Express/Nest, pg, ioredis, Socket.IO and outgoing axios calls, so one request through
 * the gateway shows up in Jaeger as a single trace across services; trace ids are added to
 * every pino log line.
 */
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

export const tracingEnabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

if (tracingEnabled) {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Noise: filesystem and DNS spans, and health/metrics probes every few seconds.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (req) => /^\/(health|metrics)\b/.test(req.url ?? ''),
        },
      }),
    ],
  });
  sdk.start();
  const shutdown = () => sdk.shutdown().catch(() => undefined);
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}
