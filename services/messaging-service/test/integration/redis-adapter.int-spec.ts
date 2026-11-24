/**
 * Two Socket.IO servers (= two messaging-service replicas) sharing one Redis: a client on
 * server B receives an event emitted to its room by server A.
 *   REDIS_URL=redis://localhost:6379 npm run test:int -- redis-adapter
 */
import { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect, Socket } from 'socket.io-client';
import { RedisIoAdapter, redisUrl } from '../../src/redis/redis-io.adapter';

async function replica() {
  const adapter = new RedisIoAdapter(undefined, redisUrl());
  await adapter.connectToRedis();
  // Without a Nest app, IoAdapter starts a standalone server on an ephemeral port.
  const server: Server = adapter.createIOServer(0, {} as any);
  const http = (server as any).httpServer;
  if (!http.listening) await new Promise((resolve) => http.once('listening', resolve));
  server.on('connection', (socket) => socket.on('join', (room: string, ack: () => void) => (socket.join(room), ack())));
  return { server, http, adapter, port: (http.address() as AddressInfo).port };
}

describe('Socket.IO Redis adapter (cross-replica delivery)', () => {
  const replicas: Awaited<ReturnType<typeof replica>>[] = [];
  let client: Socket;

  afterAll(async () => {
    client?.close();
    for (const r of replicas) {
      r.server.close();
      await r.adapter.close();
    }
  });

  it('delivers an event emitted on replica A to a client connected to replica B', async () => {
    replicas.push(await replica(), await replica());
    const [a, b] = replicas;
    client = connect(`http://127.0.0.1:${b.port}`, { transports: ['websocket'] });
    await new Promise<void>((resolve) => client.emit('join', 'conversation_x', resolve));

    const received = new Promise((resolve) => client.once('new_message', resolve));
    // Pub/sub subscription is asynchronous; the adapter's own handshake is fast but not instant.
    await new Promise((r) => setTimeout(r, 200));
    a.server.to('conversation_x').emit('new_message', { id: 'm1' });

    await expect(received).resolves.toEqual({ id: 'm1' });
  });
});
