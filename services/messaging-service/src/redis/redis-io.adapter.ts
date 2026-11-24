import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

export function redisUrl(): string {
  return (
    process.env.REDIS_URL ||
    process.env.REDIS_URI ||
    `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
  );
}

/**
 * Socket.IO over Redis pub/sub: an event emitted to a room on one instance reaches the
 * sockets connected to every other instance. Without it, two replicas behind a load
 * balancer each see only their own clients (a message sent through instance A never
 * reaches the recipient connected to instance B).
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private clients: Redis[] = [];

  constructor(app?: INestApplicationContext, private readonly url = redisUrl()) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const pubClient = new Redis(this.url, { lazyConnect: true, maxRetriesPerRequest: null });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.clients = [pubClient, subClient];
    this.adapterConstructor = createAdapter(pubClient, subClient, { key: 'marad:socket.io' });
    this.logger.log('Socket.IO rooms are shared through Redis');
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, options);
    if (this.adapterConstructor) server.adapter(this.adapterConstructor);
    return server;
  }

  async close(): Promise<void> {
    await Promise.all(this.clients.map((c) => c.quit().catch(() => undefined)));
  }
}
