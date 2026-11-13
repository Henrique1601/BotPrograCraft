import { EventEmitter } from 'node:events';
import { type IdeContextPayload, type WsMessage } from '@botprogracraft/shared';
export interface IdeWsServerEvents {
    context: (payload: IdeContextPayload) => void;
    connection: (connected: boolean, clientCount: number) => void;
    error: (error: Error) => void;
}
export declare class IdeWsServer extends EventEmitter {
    private wss;
    private readonly port;
    private readonly clients;
    private latestContext;
    constructor(port?: number);
    start(): void;
    stop(): void;
    getLatestContext(): IdeContextPayload | null;
    isIdeConnected(): boolean;
    requestContext(reason?: string): void;
    broadcast(message: WsMessage): void;
    private sendToSocket;
}
//# sourceMappingURL=wsServer.d.ts.map