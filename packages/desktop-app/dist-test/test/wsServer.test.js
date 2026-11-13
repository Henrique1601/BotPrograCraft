"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const net = __importStar(require("node:net"));
const ws_1 = require("ws");
const wsServer_1 = require("../src/main/wsServer");
async function getFreePort() {
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
                if (err)
                    reject(err);
                else
                    resolve(port);
            });
        });
    });
}
function connectClient(port, options) {
    return new Promise((resolve, reject) => {
        const ws = new ws_1.WebSocket(`ws://127.0.0.1:${port}`, options?.origin ? { headers: { Origin: options.origin } } : undefined);
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
    });
}
function closeClient(ws) {
    if (ws.readyState === ws_1.WebSocket.CLOSED ||
        ws.readyState === ws_1.WebSocket.CLOSING) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        ws.once('close', () => resolve());
        ws.close();
    });
}
(0, node_test_1.describe)('IdeWsServer security & protocol validation', () => {
    let port;
    let server;
    (0, node_test_1.beforeEach)(async () => {
        port = await getFreePort();
        server = new wsServer_1.IdeWsServer(port);
        server.start();
    });
    (0, node_test_1.afterEach)(() => {
        server.stop();
    });
    (0, node_test_1.it)('accepts connection without Origin header and processes valid ide:context', async () => {
        const client = await connectClient(port);
        try {
            const validPayload = {
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
            const contextPromise = new Promise((resolve) => {
                server.once('context', resolve);
            });
            client.send(JSON.stringify({
                type: 'ide:context',
                payload: validPayload,
                timestamp: Date.now(),
            }));
            const received = await contextPromise;
            assert.deepEqual(received, validPayload);
            assert.deepEqual(server.getLatestContext(), validPayload);
            assert.equal(server.isIdeConnected(), true);
        }
        finally {
            await closeClient(client);
        }
    });
    (0, node_test_1.it)('rejects connection with Origin header with HTTP 403 (CSWSH protection)', async () => {
        const statusCode = await new Promise((resolve, reject) => {
            const ws = new ws_1.WebSocket(`ws://127.0.0.1:${port}`, {
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
    (0, node_test_1.it)('ignores malformed ide:context payloads without crashing', async () => {
        const receivedContexts = [];
        const serverErrors = [];
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
            const pingReply = await new Promise((resolve) => {
                client.once('message', (data) => {
                    resolve(JSON.parse(data.toString('utf8')));
                });
                client.send(JSON.stringify({
                    type: 'ide:ping',
                    source: 'ide-extension',
                    timestamp: Date.now(),
                }));
            });
            assert.equal(pingReply.type, 'ide:ping');
            assert.equal(pingReply.source, 'desktop-app');
            assert.equal(receivedContexts.length, 0);
            assert.equal(server.getLatestContext(), null);
            assert.equal(serverErrors.length, 0);
        }
        finally {
            await closeClient(client);
        }
    });
    (0, node_test_1.it)('handles invalid JSON frames without crashing the server', async () => {
        const serverErrorPromise = new Promise((resolve) => {
            server.once('error', resolve);
        });
        const client = await connectClient(port);
        try {
            client.send('{not-valid-json');
            const err = await serverErrorPromise;
            assert.ok(err instanceof Error);
            const pingReply = await new Promise((resolve) => {
                client.once('message', (data) => {
                    resolve(JSON.parse(data.toString('utf8')));
                });
                client.send(JSON.stringify({
                    type: 'ide:ping',
                    source: 'ide-extension',
                    timestamp: Date.now(),
                }));
            });
            assert.equal(pingReply.type, 'ide:ping');
            assert.equal(pingReply.source, 'desktop-app');
        }
        finally {
            await closeClient(client);
        }
    });
});
//# sourceMappingURL=wsServer.test.js.map