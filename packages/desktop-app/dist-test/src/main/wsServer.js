"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdeWsServer = void 0;
const node_events_1 = require("node:events");
const ws_1 = require("ws");
const shared_1 = require("@botprogracraft/shared");
const MAX_WS_PAYLOAD_BYTES = 512 * 1024;
const VALID_SEVERITIES = new Set([
    'error',
    'warning',
    'info',
    'hint',
]);
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isValidPosition(value) {
    if (!isRecord(value))
        return false;
    return (typeof value.line === 'number' &&
        Number.isFinite(value.line) &&
        value.line >= 0 &&
        typeof value.character === 'number' &&
        Number.isFinite(value.character) &&
        value.character >= 0);
}
function isValidSelection(value) {
    if (!isRecord(value))
        return false;
    if (typeof value.text !== 'string' || typeof value.isEmpty !== 'boolean') {
        return false;
    }
    if (!isRecord(value.range))
        return false;
    return isValidPosition(value.range.start) && isValidPosition(value.range.end);
}
function isValidDiagnostic(value) {
    if (!isRecord(value))
        return false;
    if (typeof value.message !== 'string' ||
        typeof value.severity !== 'string' ||
        !VALID_SEVERITIES.has(value.severity) ||
        typeof value.line !== 'number' ||
        !Number.isFinite(value.line) ||
        value.line < 0) {
        return false;
    }
    if (value.character !== undefined &&
        (typeof value.character !== 'number' ||
            !Number.isFinite(value.character) ||
            value.character < 0)) {
        return false;
    }
    if (value.source !== undefined && typeof value.source !== 'string') {
        return false;
    }
    if (value.code !== undefined &&
        typeof value.code !== 'string' &&
        (typeof value.code !== 'number' || !Number.isFinite(value.code))) {
        return false;
    }
    return true;
}
function isValidIdeContextPayload(value) {
    if (!isRecord(value))
        return false;
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
    if (!Array.isArray(value.diagnostics) ||
        !value.diagnostics.every(isValidDiagnostic)) {
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
class IdeWsServer extends node_events_1.EventEmitter {
    wss = null;
    port;
    clients = new Set();
    latestContext = null;
    constructor(port = shared_1.DEFAULT_WS_PORT) {
        super();
        this.port = port;
    }
    start() {
        if (this.wss)
            return;
        this.wss = new ws_1.WebSocketServer({
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
                    const parsed = JSON.parse(raw.toString('utf8'));
                    if (!(0, shared_1.isWsMessage)(parsed)) {
                        return;
                    }
                    if (parsed.type === 'ide:context') {
                        if (!isValidIdeContextPayload(parsed.payload)) {
                            return;
                        }
                        this.latestContext = parsed.payload;
                        this.emit('context', parsed.payload);
                    }
                    else if (parsed.type === 'ide:ping') {
                        this.sendToSocket(socket, {
                            type: 'ide:ping',
                            source: 'desktop-app',
                            timestamp: Date.now(),
                        });
                    }
                }
                catch (err) {
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
    stop() {
        for (const client of this.clients) {
            client.close();
        }
        this.clients.clear();
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }
    getLatestContext() {
        return this.latestContext;
    }
    isIdeConnected() {
        return this.clients.size > 0;
    }
    requestContext(reason = 'manual') {
        const msg = {
            type: 'desktop:request-context',
            reason,
            timestamp: Date.now(),
        };
        this.broadcast(msg);
    }
    broadcast(message) {
        const data = JSON.stringify(message);
        for (const client of this.clients) {
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(data);
            }
        }
    }
    sendToSocket(socket, message) {
        if (socket.readyState === ws_1.WebSocket.OPEN) {
            socket.send(JSON.stringify(message));
        }
    }
}
exports.IdeWsServer = IdeWsServer;
//# sourceMappingURL=wsServer.js.map