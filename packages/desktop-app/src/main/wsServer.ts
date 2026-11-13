import { EventEmitter } from 'node:events';
import { WebSocket, WebSocketServer } from 'ws';
import {
  DEFAULT_WS_PORT,
  isWsMessage,
  type IdeContextPayload,
  type IdeDiagnostic,
  type IdeDiagnosticSeverity,
  type IdePosition,
  type IdeSelection,
  type WsDesktopRequestContextMessage,
  type WsMessage,
} from '@botprogracraft/shared';

const MAX_WS_PAYLOAD_BYTES = 512 * 1024;
const VALID_SEVERITIES: ReadonlySet<IdeDiagnosticSeverity> = new Set([
  'error',
  'warning',
  'info',
  'hint',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidPosition(value: unknown): value is IdePosition {
  if (!isRecord(value)) return false;
  return (
    typeof value.line === 'number' &&
    Number.isFinite(value.line) &&
    value.line >= 0 &&
    typeof value.character === 'number' &&
    Number.isFinite(value.character) &&
    value.character >= 0
  );
}

function isValidSelection(value: unknown): value is IdeSelection {
  if (!isRecord(value)) return false;
  if (typeof value.text !== 'string' || typeof value.isEmpty !== 'boolean') {
    return false;
  }
  if (!isRecord(value.range)) return false;
  return isValidPosition(value.range.start) && isValidPosition(value.range.end);
}

function isValidDiagnostic(value: unknown): value is IdeDiagnostic {
  if (!isRecord(value)) return false;
  if (
    typeof value.message !== 'string' ||
    typeof value.severity !== 'string' ||
    !VALID_SEVERITIES.has(value.severity as IdeDiagnosticSeverity) ||
    typeof value.line !== 'number' ||
    !Number.isFinite(value.line) ||
    value.line < 0
  ) {
    return false;
  }
  if (
    value.character !== undefined &&
    (typeof value.character !== 'number' ||
      !Number.isFinite(value.character) ||
      value.character < 0)
  ) {
    return false;
  }
  if (value.source !== undefined && typeof value.source !== 'string') {
    return false;
  }
  if (
    value.code !== undefined &&
    typeof value.code !== 'string' &&
    (typeof value.code !== 'number' || !Number.isFinite(value.code))
  ) {
    return false;
  }
  return true;
}

function isValidIdeContextPayload(value: unknown): value is IdeContextPayload {
  if (!isRecord(value)) return false;
  if (value.activeFile !== null && typeof value.activeFile !== 'string') {
    return false;
  }
  if (typeof value.languageId !== 'string') {
    return false;
  }
  if (value.selection !== null && !isValidSelection(value.selection)) {
    return false;
  }
  if (typeof value.visibleRangeText !== 'string') {
    return false;
  }
  if (
    !Array.isArray(value.diagnostics) ||
    !value.diagnostics.every(isValidDiagnostic)
  ) {
    return false;
  }
  if (value.workspaceName !== null && typeof value.workspaceName !== 'string') {
    return false;
  }
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) {
    return false;
  }
  return true;
}

export interface IdeWsServerEvents {
  context: (payload: IdeContextPayload) => void;
  connection: (connected: boolean, clientCount: number) => void;
  error: (error: Error) => void;
}

export class IdeWsServer extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private readonly port: number;
  private readonly clients = new Set<WebSocket>();
  private latestContext: IdeContextPayload | null = null;

  constructor(port = DEFAULT_WS_PORT) {
    super();
    this.port = port;
  }

  start(): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({
      port: this.port,
      host: '127.0.0.1',
      maxPayload: MAX_WS_PAYLOAD_BYTES,
      perMessageDeflate: false,
      verifyClient: (info, callback) => {
        // Reject browser-originated WebSocket handshakes (CSWSH protection).
        if ('origin' in info.req.headers) {
          callback(false, 403, 'Origin header not allowed');
          return;
        }
        callback(true);
      },
    });

    this.wss.on('connection', (socket) => {
      this.clients.add(socket);
      this.emit('connection', true, this.clients.size);

      socket.on('message', (raw) => {
        try {
          const parsed: unknown = JSON.parse(raw.toString('utf8'));
          if (!isWsMessage(parsed)) {
            return;
          }
          if (parsed.type === 'ide:context') {
            if (!isValidIdeContextPayload(parsed.payload)) {
              return;
            }
            this.latestContext = parsed.payload;
            this.emit('context', parsed.payload);
          } else if (parsed.type === 'ide:ping') {
            this.sendToSocket(socket, {
              type: 'ide:ping',
              source: 'desktop-app',
              timestamp: Date.now(),
            });
          }
        } catch (err) {
          this.emit('error', err instanceof Error ? err : new Error(String(err)));
        }
      });

      socket.on('close', () => {
        this.clients.delete(socket);
        this.emit('connection', this.clients.size > 0, this.clients.size);
      });

      socket.on('error', (err) => {
        this.emit('error', err);
      });
    });

    this.wss.on('error', (err) => {
      this.emit('error', err);
    });
  }

  stop(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  getLatestContext(): IdeContextPayload | null {
    return this.latestContext;
  }

  isIdeConnected(): boolean {
    return this.clients.size > 0;
  }

  requestContext(reason = 'manual'): void {
    const msg: WsDesktopRequestContextMessage = {
      type: 'desktop:request-context',
      reason,
      timestamp: Date.now(),
    };
    this.broadcast(msg);
  }

  broadcast(message: WsMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  private sendToSocket(socket: WebSocket, message: WsMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}
