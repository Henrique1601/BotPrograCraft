import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert/strict';
import * as net from 'node:net';
import { WebSocket } from 'ws';
import type { IdeContextPayload } from '@botprogracraft/shared';
import { IdeWsServer } from '../src/main/wsServer';

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const address = srv.address();
      if (!address || typeof address === 'string') {
        srv.close(() => reject(new Error('Failed to allocate ephemeral port')));
        return;
      }
      const { port } = address;
      srv.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

function connectClient(
  port: number,
  options?: { origin?: string },
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}`,
      options?.origin ? { headers: { Origin: options.origin } } : undefined,
    );
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function closeClient(ws: WebSocket): Promise<void> {
  if (
    ws.readyState === WebSocket.CLOSED ||
    ws.readyState === WebSocket.CLOSING
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    ws.once('close', () => resolve());
    ws.close();
  });
}

describe('IdeWsServer security & protocol validation', () => {
  let port: number;
  let server: IdeWsServer;

  beforeEach(async () => {
    port = await getFreePort();
    server = new IdeWsServer(port);
    server.start();
  });

  afterEach(() => {
    server.stop();
  });

  it('accepts connection without Origin header and processes valid ide:context', async () => {
    const client = await connectClient(port);
    try {
      const validPayload: IdeContextPayload = {
        activeFile: 'src/index.ts',
        languageId: 'typescript',
        selection: {
          text: 'const x = 1;',
          isEmpty: false,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 12 },
          },
        },
        visibleRangeText: 'const x = 1;',
        diagnostics: [
          {
            message: 'Unused variable',
            severity: 'warning',
            line: 0,
            character: 6,
            source: 'ts',
            code: 6133,
          },
        ],
        workspaceName: 'BotPrograCraft',
        timestamp: 1700000000000,
      };

      const contextPromise = new Promise<IdeContextPayload>((resolve) => {
        server.once('context', resolve);
      });

      client.send(
        JSON.stringify({
          type: 'ide:context',
          payload: validPayload,
          timestamp: Date.now(),
        }),
      );

      const received = await contextPromise;
      assert.deepEqual(received, validPayload);
      assert.deepEqual(server.getLatestContext(), validPayload);
      assert.equal(server.isIdeConnected(), true);
    } finally {
      await closeClient(client);
    }
  });

  it('rejects connection with Origin header with HTTP 403 (CSWSH protection)', async () => {
    const statusCode = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
        headers: { Origin: 'https://evil.example' },
      });
      ws.once('open', () => {
        ws.close();
        reject(new Error('Expected connection with Origin header to be rejected'));
      });
      ws.once('unexpected-response', (_req, res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      ws.once('error', () => {
        // Expected after unexpected-response 403
      });
    });

    assert.equal(statusCode, 403);
    assert.equal(server.isIdeConnected(), false);
  });

  it('ignores malformed ide:context payloads without crashing', async () => {
    const receivedContexts: IdeContextPayload[] = [];
    const serverErrors: Error[] = [];
    server.on('context', (payload) => receivedContexts.push(payload));
    server.on('error', (err) => serverErrors.push(err));

    const client = await connectClient(port);
    try {
      const malformedMessages = [
        { type: 'ide:context', payload: null, timestamp: Date.now() },
        {
          type: 'ide:context',
          payload: { activeFile: 123, languageId: 'ts' },
          timestamp: Date.now(),
        },
        {
          type: 'ide:context',
          timestamp: Date.now(),
          payload: {
            activeFile: 'a.ts',
            languageId: 'typescript',
            selection: {
              text: 'x',
              isEmpty: false,
              range: {
                start: { line: -1, character: 0 },
                end: { line: 0, character: 1 },
              },
            },
            visibleRangeText: 'x',
            diagnostics: [],
            workspaceName: null,
            timestamp: 1700000000000,
          },
        },
        {
          type: 'ide:context',
          timestamp: Date.now(),
          payload: {
            activeFile: 'a.ts',
            languageId: 'typescript',
            selection: null,
            visibleRangeText: 'x',
            diagnostics: [{ message: 'err', severity: 'fatal', line: 0 }],
            workspaceName: null,
            timestamp: 1700000000000,
          },
        },
      ];

      for (const msg of malformedMessages) {
        client.send(JSON.stringify(msg));
      }

      const pingReply = await new Promise<Record<string, unknown>>((resolve) => {
        client.once('message', (data) => {
          resolve(JSON.parse(data.toString('utf8')) as Record<string, unknown>);
        });
        client.send(
          JSON.stringify({
            type: 'ide:ping',
            source: 'ide-extension',
            timestamp: Date.now(),
          }),
        );
      });

      assert.equal(pingReply.type, 'ide:ping');
      assert.equal(pingReply.source, 'desktop-app');
      assert.equal(receivedContexts.length, 0);
      assert.equal(server.getLatestContext(), null);
      assert.equal(serverErrors.length, 0);
    } finally {
      await closeClient(client);
    }
  });

  it('handles invalid JSON frames without crashing the server', async () => {
    const serverErrorPromise = new Promise<Error>((resolve) => {
      server.once('error', resolve);
    });

    const client = await connectClient(port);
    try {
      client.send('{not-valid-json');
      const err = await serverErrorPromise;
      assert.ok(err instanceof Error);

      const pingReply = await new Promise<Record<string, unknown>>((resolve) => {
        client.once('message', (data) => {
          resolve(JSON.parse(data.toString('utf8')) as Record<string, unknown>);
        });
        client.send(
          JSON.stringify({
            type: 'ide:ping',
            source: 'ide-extension',
            timestamp: Date.now(),
          }),
        );
      });

      assert.equal(pingReply.type, 'ide:ping');
      assert.equal(pingReply.source, 'desktop-app');
    } finally {
      await closeClient(client);
    }
  });
});
