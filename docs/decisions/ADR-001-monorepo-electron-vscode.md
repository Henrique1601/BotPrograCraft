# ADR-001: Monorepo TypeScript com Electron, React, Extensão VS Code/Antigravity e Gemini Live API

- **Status:** Aceita
- **Data:** 2026-11-13
- **Contexto:** O BotPrograCraft precisa operar simultaneamente em três superfícies: (1) dentro da IDE (VS Code / Antigravity) para capturar código, seleção e diagnósticos; (2) no sistema operacional como HUD flutuante *always-on-top* com captura de tela e áudio; e (3) em um núcleo compartilhado de prompts, agregação de contexto e sessão multimodal em tempo real.

## Decisão

Adotar um **monorepo TypeScript** baseado em npm workspaces (`packages/*`) dividido em quatro pacotes:

1. **`@botprogracraft/shared`**: Contratos TypeScript puros, tipos de protocolo WebSocket, definições dos 5 `TutorMode` e utilitários compartilhados.
2. **`@botprogracraft/ai-core`**: Construtores de prompt por modo, agregador de contexto (IDE + tela) e gerenciador de sessão com a **Gemini Live API** (`@google/genai`).
3. **`@botprogracraft/desktop-app`**: Aplicação **Electron + React + Vite** que renderiza o HUD flutuante, hospeda o servidor WebSocket local (porta padrão `4848`), captura áudio/tela e persiste o histórico local.
4. **`@botprogracraft/ide-extension`**: Extensão compatível com **VS Code (`^1.85.0`) e Antigravity IDE**, responsável por transmitir contexto ativo do editor via WebSocket com debounce configurável.

## Alternativas Consideradas

- **Extensão pura no VS Code (Webview):** Rejeitada porque Webviews não têm acesso direto e flexível à captura de tela global do SO, controle de janela *always-on-top* independente da IDE nem pipeline de áudio nativo sem restrições de sandbox.
- **App Desktop isolado sem extensão da IDE:** Rejeitado porque depender apenas de OCR/visão de tela perde precisão em símbolos, caminhos de arquivo, seleções longas e diagnósticos do Language Server.
- **Backend Python separado para IA:** Rejeitado para evitar multi-runtime, duplicação de contratos de tipos e complexidade de empacotamento para o usuário final.

## Consequências

- **Positivas:** Tipagem ponta a ponta entre IDE, núcleo de IA e HUD; zero latência de rede extra (tudo roda localmente falando direto com a Gemini Live API); build e testes unificados via `npm run build`, `npm run typecheck` e `npm run test`.
- **Negativas:** Exige disciplina de build em ordem de dependência (`@botprogracraft/shared` -> `@botprogracraft/ai-core` -> consumidores) e compatibilidade rigorosa de versões TypeScript entre os workspaces.
