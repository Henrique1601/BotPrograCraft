# Changelog

All notable changes to **BotPrograCraft** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-13

### Added
- Monorepo TypeScript architecture (`@botprogracraft/shared`, `@botprogracraft/ai-core`, `@botprogracraft/storage`, `@botprogracraft/desktop-app`, `botprogracraft-ide-extension`).
- Live multimodal Gemini Live API integration (`@google/genai`) with bidirectional 16kHz PCM mic capture and 24kHz PCM playback in the Electron HUD.
- Five tutor modes including `direct` ("Direto (Sem Filtro)") with permissive `BLOCK_NONE` safety settings when unfiltered.
- Smart screen-frame change detection (`ScreenFrameGate`) to reduce redundant frame transmissions.
- TypeSafe AI runtime validation with Zod schemas (`LogicChallengeSchema`, `BugAnalysisSchema`, `ExerciseFeedbackSchema`).
- Local SQLite persistence (`node:sqlite` on Node 24+) for exercise attempts, recurring errors, and session history.
- VS Code & Antigravity IDE extension (`botprogracraft-ide-extension-0.1.0.vsix`) streaming active editor context, selection, and diagnostics over localhost WebSocket (`ws://127.0.0.1:4848`).
- Compact/Expanded floating HUD overlay with animated voice-wave indicators and Progress dashboard.
- Security hardening: CSWSH `Origin` rejection on local WebSocket, `maxPayload` cap, Electron `sandbox: true`, navigation/popup blocking, and sensitive file redaction in the IDE extension.
