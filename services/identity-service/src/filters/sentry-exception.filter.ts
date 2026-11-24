import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import * as Sentry from '@sentry/node';

/**
 * One error shape for every service (identical copy in each, checked in CI):
 *   { statusCode, error, message, requestId, timestamp, path }
 * `message` keeps the value clients already read (a string, or the list of validation
 * errors); `requestId` is the X-Request-ID the gateway assigned, to find the request in logs.
 */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
  timestamp: string;
  path?: string;
}

export function toErrorBody(status: number, payload: unknown, request?: { url?: string; headers?: Record<string, unknown> }): ErrorBody {
  const fromObject = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : undefined;
  const message = fromObject?.message ?? (typeof payload === 'string' ? payload : STATUS_CODES[status] ?? 'Error');
  const requestId = request?.headers?.['x-request-id'];
  return {
    ...(fromObject ?? {}),
    statusCode: status,
    error: typeof fromObject?.error === 'string' ? fromObject.error : STATUS_CODES[status] ?? 'Error',
    message: message as string | string[],
    requestId: typeof requestId === 'string' ? requestId : undefined,
    timestamp: new Date().toISOString(),
    path: request?.url?.split('?')[0],
  };
}

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledError');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) Sentry.captureException(exception);
      response.status(status).json(toErrorBody(status, exception.getResponse(), request));
      return;
    }

    // Anything else is a bug: report it and keep the stack in the logs. The client only
    // gets a generic message (no internals leak).
    Sentry.captureException(exception);
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${request?.method} ${request?.url} [${request?.headers?.['x-request-id'] ?? '-'}]: ${err.message}`, err.stack);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(toErrorBody(HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error', request));
  }
}
