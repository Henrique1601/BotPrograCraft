import * as vscode from 'vscode';
import WebSocket from 'ws';
import {
  DEFAULT_WS_PORT,
  TUTOR_MODES,
  TUTOR_MODE_INFO,
  isTutorMode,
  isWsMessage,
  type IdeContextPayload,
  type LiveSessionStatus,
  type TutorMode,
  type WsMessage,
} from '@botprogracraft/shared';
import { IdeContextWatcher, collectIdeContext } from './contextCollector';

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 20_000;

interface ExtensionConfig {
  wsPort: number;
  liveSync: boolean;
  debounceMs: number;
}

function readConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration('botprogracraft');
  const rawPort = config.get<number>('wsPort', DEFAULT_WS_PORT);
  const wsPort =
    Number.isInteger(rawPort) && rawPort >= 1024 && rawPort <= 65535
      ? rawPort
      : DEFAULT_WS_PORT;

  const liveSync = config.get<boolean>('liveSync', true);
  const rawDebounce = config.get<number>('debounceMs', 250);
  const debounceMs =
    typeof rawDebounce === 'number' && Number.isFinite(rawDebounce)
      ? Math.min(5_000, Math.max(50, rawDebounce))
      : 250;

  return { wsPort, liveSync, debounceMs };
}

class IdeBridgeClient implements vscode.Disposable {
  private socket: WebSocket | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private disposed = false;

  private connectionState: ConnectionState = 'disconnected';
  private config: ExtensionConfig = readConfig();
  private tutorMode: TutorMode = 'socratic';
  private lastSessionStatus: LiveSessionStatus = 'disconnected';

  private readonly statusBarItem: vscode.StatusBarItem;
  private readonly watcher: IdeContextWatcher;
  private readonly outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('BotPrograCraft');
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'botprogracraft.toggleLiveSync';
    this.statusBarItem.show();

    this.watcher = new IdeContextWatcher({
      getDebounceMs: () => this.config.debounceMs,
      isLiveSyncEnabled: () => this.config.liveSync,
      onContext: (payload) => this.sendContext(payload),
    });

    this.updateStatusBar();
  }

  public start(): void {
    this.connect();
  }

  public handleConfigurationChange(event: vscode.ConfigurationChangeEvent): void {
    if (!event.affectsConfiguration('botprogracraft')) {
      return;
    }

    const previousPort = this.config.wsPort;
    const previousLiveSync = this.config.liveSync;
    this.config = readConfig();

    if (this.config.wsPort !== previousPort) {
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.teardownSocket();
      this.connect();
    } else if (!previousLiveSync && this.config.liveSync) {
      this.sendContext(collectIdeContext());
    }

    this.updateStatusBar();
  }

  public async toggleLiveSync(): Promise<void> {
    const nextValue = !this.config.liveSync;
    this.config = { ...this.config, liveSync: nextValue };

    const wsConfig = vscode.workspace.getConfiguration('botprogracraft');
    try {
      await wsConfig.update('liveSync', nextValue, vscode.ConfigurationTarget.Global);
    } catch {
      // Keep in-memory state if workspace/global settings are read-only.
    }

    this.updateStatusBar();

    if (nextValue) {
      this.sendContext(collectIdeContext());
      vscode.window.setStatusBarMessage('BotPrograCraft: Live sync enabled', 2500);
    } else {
      vscode.window.setStatusBarMessage('BotPrograCraft: Live sync paused', 2500);
    }
  }

  public sendCurrentSelection(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage(
        'BotPrograCraft: Open a file in the editor to send context.'
      );
      return;
    }

    const payload = collectIdeContext(editor);
    const sent = this.sendContext(payload);

    if (!sent) {
      vscode.window.showWarningMessage(
        `BotPrograCraft desktop app is not connected on ws://localhost:${this.config.wsPort}.`
      );
      return;
    }

    const selectionInfo =
      payload.selection && !payload.selection.isEmpty
        ? 'selection'
        : 'active editor context';
    vscode.window.setStatusBarMessage(`BotPrograCraft: Sent ${selectionInfo}`, 2500);
  }

  public async switchTutorMode(): Promise<void> {
    const items = TUTOR_MODES.map((mode) => {
      const info = TUTOR_MODE_INFO[mode];
      return {
        label: info.label,
        description: mode === this.tutorMode ? '(current)' : undefined,
        detail: info.description,
        mode,
      };
    });

    const picked = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select BotPrograCraft Tutor Mode',
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!picked) {
      return;
    }

    this.tutorMode = picked.mode;
    this.updateStatusBar();

    this.sendMessage({
      type: 'ai:status',
      status: this.lastSessionStatus,
      tutorMode: picked.mode,
      message: `Tutor mode switched to ${TUTOR_MODE_INFO[picked.mode].label}`,
      timestamp: Date.now(),
    });

    vscode.window.setStatusBarMessage(
      `BotPrograCraft: Mode set to ${TUTOR_MODE_INFO[picked.mode].label}`,
      2500
    );
  }

  private connect(): void {
    if (this.disposed) {
      return;
    }

    this.clearReconnectTimer();

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = `ws://localhost:${this.config.wsPort}`;
    this.setConnectionState('connecting');

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (error) {
      this.log(`Failed to create WebSocket for ${url}: ${String(error)}`);
      this.setConnectionState('disconnected');
      this.scheduleReconnect();
      return;
    }

    this.socket = ws;

    ws.on('open', () => {
      if (this.disposed || this.socket !== ws) {
        return;
      }
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.setConnectionState('connected');
      this.log(`Connected to ${url}`);

      this.sendMessage({
        type: 'ide:ping',
        source: 'ide-extension',
        timestamp: Date.now(),
      });

      if (this.config.liveSync) {
        this.sendContext(collectIdeContext());
      }

      this.startHeartbeat();
    });

    ws.on('message', (data) => {
      if (this.disposed || this.socket !== ws) {
        return;
      }
      this.handleIncomingMessage(data.toString());
    });

    ws.on('error', (error) => {
      if (this.disposed || this.socket !== ws) {
        return;
      }
      // Desktop app may simply not be running yet; log quietly and let close/reconnect handle it.
      this.log(`WebSocket error (${url}): ${error.message}`);
    });

    ws.on('close', () => {
      if (this.socket === ws) {
        this.socket = undefined;
      }
      this.stopHeartbeat();
      if (!this.disposed) {
        this.setConnectionState('disconnected');
        this.scheduleReconnect();
      }
    });
  }

  private handleIncomingMessage(raw: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isWsMessage(parsed)) {
      return;
    }

    switch (parsed.type) {
      case 'desktop:request-context':
        this.sendContext(collectIdeContext());
        break;
      case 'ai:status':
        this.lastSessionStatus = parsed.status;
        if (isTutorMode(parsed.tutorMode)) {
          this.tutorMode = parsed.tutorMode;
          this.updateStatusBar();
        }
        break;
      default:
        break;
    }
  }

  private sendContext(payload: IdeContextPayload): boolean {
    return this.sendMessage({
      type: 'ide:context',
      payload,
      timestamp: Date.now(),
    });
  }

  private sendMessage(message: WsMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.log(`Failed to send ${message.type}: ${String(error)}`);
      return false;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer !== undefined) {
      return;
    }

    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(MAX_RECONNECT_DELAY_MS, delay * 2);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendMessage({
        type: 'ide:ping',
        source: 'ide-extension',
        timestamp: Date.now(),
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private teardownSocket(): void {
    this.clearReconnectTimer();
    this.stopHeartbeat();
    if (this.socket) {
      const ws = this.socket;
      this.socket = undefined;
      ws.removeAllListeners();
      try {
        ws.close();
      } catch {
        // Ignore close errors during teardown.
      }
    }
    this.setConnectionState('disconnected');
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) {
      return;
    }
    this.connectionState = state;
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const modeLabel = TUTOR_MODE_INFO[this.tutorMode].label;
    const url = `ws://localhost:${this.config.wsPort}`;

    if (this.connectionState === 'connected') {
      if (this.config.liveSync) {
        this.statusBarItem.text = '$(broadcast) BotPrograCraft: Live';
        this.statusBarItem.tooltip = `Connected to ${url}\nLive Sync: On\nTutor Mode: ${modeLabel}\nClick to pause live sync`;
      } else {
        this.statusBarItem.text = '$(circle-slash) BotPrograCraft: Paused';
        this.statusBarItem.tooltip = `Connected to ${url}\nLive Sync: Paused\nTutor Mode: ${modeLabel}\nClick to resume live sync`;
      }
      return;
    }

    if (this.connectionState === 'connecting') {
      this.statusBarItem.text = '$(sync~spin) BotPrograCraft: Connecting';
      this.statusBarItem.tooltip = `Connecting to ${url}...\nTutor Mode: ${modeLabel}`;
      return;
    }

    this.statusBarItem.text = '$(debug-disconnect) BotPrograCraft: Offline';
    this.statusBarItem.tooltip = `Waiting for BotPrograCraft desktop app at ${url}\nLive Sync: ${
      this.config.liveSync ? 'On' : 'Paused'
    }\nTutor Mode: ${modeLabel}\nClick to toggle live sync`;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }

  public dispose(): void {
    this.disposed = true;
    this.teardownSocket();
    this.watcher.dispose();
    this.statusBarItem.dispose();
    this.outputChannel.dispose();
  }
}

let bridgeClient: IdeBridgeClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const client = new IdeBridgeClient();
  bridgeClient = client;

  context.subscriptions.push(
    client,
    vscode.workspace.onDidChangeConfiguration((event) =>
      client.handleConfigurationChange(event)
    ),
    vscode.commands.registerCommand('botprogracraft.toggleLiveSync', () =>
      client.toggleLiveSync()
    ),
    vscode.commands.registerCommand('botprogracraft.sendSelection', () =>
      client.sendCurrentSelection()
    ),
    vscode.commands.registerCommand('botprogracraft.switchTutorMode', () =>
      client.switchTutorMode()
    )
  );

  client.start();
}

export function deactivate(): void {
  bridgeClient?.dispose();
  bridgeClient = undefined;
}
