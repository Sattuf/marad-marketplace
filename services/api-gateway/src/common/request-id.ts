import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/** A client-supplied id is kept only if it is short and harmless (it ends up in logs). */
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Every request gets an X-Request-ID: the client's if it is safe, a new UUID otherwise.
 * The gateway forwards it to the service and returns it to the client, and every service
 * puts it in its error bodies and logs — one id to follow a request across the system.
 */
export function requestId(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-ID', id);
  next();
}
