# BotPrograCraft

AI-powered Socratic & Pair-Programming Tutor combining a **VS Code / Antigravity IDE extension**, a **floating Electron + React HUD**, and **Gemini Live API** multimodal streaming (voice, text, screen capture, and live IDE context).

## Workspace Architecture

| Package | Name | Description |
| --- | --- | --- |
| `packages/shared` | `@botprogracraft/shared` | Shared TypeScript contracts (`TutorMode`, `IdeContextPayload`, `WsMessage`, `ScreenFrame`, `LiveSessionConfig`). |
| `packages/ai-core` | `@botprogracraft/ai-core` | System prompt builder for all 4 tutor modes, context aggregator, and Gemini Live API session manager. |
| `packages/ide-extension` | `@botprogracraft/ide-extension` | VS Code / Antigravity extension streaming active editor, selection, and diagnostics over local WebSocket (`ws://localhost:4848`). |
| `packages/desktop-app` | `@botprogracraft/desktop-app` | Electron + React always-on-top floating HUD with voice capture, screen capture, and WebSocket server. |

## Getting Started

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`:
   ```bash
   cp .env.example .env
   ```
2. Install dependencies across all workspaces:
   ```bash
   npm install
   ```
3. Build `@botprogracraft/shared` and all workspace packages:
   ```bash
   npm run build
   ```
4. Typecheck and run tests:
   ```bash
   npm run typecheck
   npm test
   ```
