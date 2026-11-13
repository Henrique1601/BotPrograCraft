# Changelog

All notable changes to **BotPrograCraft** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-13

### Added
- **MCP On-Demand Screen Capture Fallback**: `get_live_screen` in `@botprogracraft/mcp-server` now accepts `captureNow` and falls back to `captureWindowsScreenJpeg()` when `latest-frame.jpg` is missing or requested on demand.
- **Ollama Local Provider & Web Speech API Voice**: Added `AiProviderType` (`'gemini-live' | 'ollama'`), `OllamaClient` (`http://127.0.0.1:11434`), and `useWebSpeech` (Web Speech API TTS & speech recognition) in the Electron HUD so users can run fully local tutoring without a Gemini API key.
- **Local Exercise Code Runner (`run_exercise_check`)**: Added `runExerciseCheck` in `@botprogracraft/ai-core` and exposed it via both the MCP server (`run_exercise_check`) and the HUD **Desafio** tab ("Testar Código") to execute JavaScript, TypeScript, and Python test cases in isolated child processes with strict timeouts.

## [0.2.0] - 2026-11-13

### Added
- **Interactive Logic Challenge Card**: Structured challenge generation (`StructuredChallengeService`) and Zod-validated solution evaluation in the HUD **Desafio** tab with automatic SQLite attempt recording.
- **Automatic IDE Recurring Error Tracking**: IDE `error` diagnostics received over the local WebSocket bridge are automatically tracked in SQLite and surfaced in the **Progresso** tab (**Top Erros Recorrentes**).
- **Window/Screen Source Selector & Privacy Preview**: Selectable screen or window capture sources (`listCaptureSources` / `setCaptureSource`) with a compact privacy preview thumbnail showing `ScreenFrameGate` transmission status.
- **Push-to-Talk & Voice Barge-In**: Global `Ctrl+Shift+Space` shortcut toggles mic capture in the HUD, and starting/streaming mic audio immediately interrupts active AI audio playback for natural barge-in.
- **Official App Icon & Windows System Tray**: Generated `assets/icon.png` and `assets/icon.ico` from `assets/logo.jpg`, wired into the Electron `BrowserWindow` icon, Windows build config, and System Tray (show/hide HUD and Quit).

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
