# PRD — BotPrograCraft

**Status:** Aprovado para Implementação  
**Versão:** 1.0  
**Workspace:** `BotPrograCraft` (`@botprogracraft/shared`, `@botprogracraft/ai-core`, `@botprogracraft/desktop-app`, `@botprogracraft/ide-extension`)

---

## 1. Visão do Produto

O **BotPrograCraft** é um tutor de programação e parceiro de *pair-programming* em tempo real que combina **voz bidirecional ao vivo (Gemini Live API)**, **leitura inteligente de tela** e **contexto estruturado da IDE (VS Code / Antigravity)** em um **HUD flutuante desktop (Electron + React)**.

Diferente de chatbots tradicionais baseados apenas em texto e copiar/colar, o BotPrograCraft enxerga o editor ativo, os diagnósticos de compilação/lint e a tela do desenvolvedor, respondendo por voz com baixa latência e adaptando sua postura pedagógica conforme o modo selecionado.

### Non-Goals (Fora de Escopo)
- Substituir a IDE ou executar edições autônomas em massa no repositório sem aprovação do usuário.
- Sincronização em nuvem ou backend remoto multi-tenant (todo histórico e estado permanecem locais).
- Suporte a IDEs fora da família VS Code / Antigravity na v1.

---

## 2. Personas

| Persona | Perfil | Dor Principal | Como o BotPrograCraft Resolve |
| :--- | :--- | :--- | :--- |
| **Aprendiz / Estudante** | Desenvolvedor iniciante ou em transição | Trava em erros de sintaxe/lógica e recebe respostas prontas que não ensinam | Modos `socratic` e `logic-challenge` guiam com perguntas e dicas progressivas sem entregar a resposta de imediato. |
| **Dev Júnior / Pleno** | Constrói features no dia a dia | Perde tempo alternando janelas e colando stacktraces em chats | Ponte WebSocket lê código, seleção e erros da IDE automaticamente; modo `explain-bug` diagnostica a causa raiz. |
| **Dev Sênior / Pragmático** | Precisa de velocidade e código direto | Odeia rodeios pedagógicos quando já sabe o que quer | Modo `direct` (*Direto / Sem Filtro*) entrega código completo, refatorações e respostas imediatas sem retenção. |

---

## 3. Os 5 Modos de Tutoria (`TutorMode`)

Definidos em `@botprogracraft/shared`:

1. **`socratic` (Socratic):** Guia o usuário com perguntas direcionadas, estimulando o raciocínio sem entregar a solução pronta.
2. **`pair-programming` (Pair Programming):** Colabora diretamente em arquitetura, refatorações e implementação, propondo melhorias e trade-offs.
3. **`explain-bug` (Explain Bug):** Analisa diagnósticos, stacktraces e trechos selecionados, explicando a causa raiz passo a passo.
4. **`logic-challenge` (Logic Challenge):** Atua como coach em desafios de algoritmos e lógica usando dicas progressivas.
5. **`direct` (Direto — Sem Filtro):** Respostas diretas, objetivas e sem filtro pedagógico, fornecendo código completo, comandos exatos e correções imediatas.

---

## 4. Requisitos Funcionais

### RF-01: Voz ao Vivo Bidirecional
- Conexão em tempo real com a **Gemini Live API** (`@google/genai`) suportando streaming de áudio de entrada (microfone) e saída (voz sintetizada), além de entrada/saída textual no HUD.
- Suporte a interrupção (*barge-in*) e troca dinâmica de `TutorMode` sem perder o contexto da sessão.

### RF-02: Leitura de Tela Inteligente (*Smart Frames*)
- Captura periódica da tela ou janela ativa pelo processo Electron.
- **Detecção de mudança de tela:** apenas frames com variação visual relevante acima do limiar configurado são enviados à API, evitando envio redundante de frames estáticos e reduzindo consumo de tokens.

### RF-03: Ponte IDE (VS Code / Antigravity)
- Extensão `@botprogracraft/ide-extension` conectada via WebSocket local (`ws://127.0.0.1:4848`, configurável via `botprogracraft.wsPort`).
- Envia automaticamente (com *debounce* configurável via `botprogracraft.debounceMs`) arquivo ativo, linguagem, trecho selecionado e diagnósticos (`errors`/`warnings`).
- Comandos na paleta da IDE: `Toggle Live Sync`, `Send Current Selection` e `Switch Tutor Mode`.

### RF-04: Persistência Local com SQLite
- Armazenamento local de sessões, mensagens, trocas de modo e metadados de uso utilizando **`node:sqlite`** nativo do Node.js 24+, sem dependências nativas C++ externas (`better-sqlite3`, `sqlite3`, etc.).

### RF-05: TypeSafe AI com Zod
- Contratos de entrada/saída de IA, mensagens WebSocket e payloads estruturados validados em runtime com **Zod**.
- Respostas estruturadas do tutor (ex.: diagnóstico, dica, código sugerido, próximos passos) passam por validação estrita de schema antes de serem renderizadas no HUD.

---

## 5. Critérios de Aceite Testáveis

| ID | Requisito | Critério de Aceite |
| :--- | :--- | :--- |
| **CA-01** | Modos de Tutoria | `isTutorMode()` aceita exatamente os 5 valores (`socratic`, `pair-programming`, `explain-bug`, `logic-challenge`, `direct`) e rejeita valores inválidos; prompt builder do modo `direct` instrui explicitamente resposta direta com código completo e sem retenção pedagógica. |
| **CA-02** | Ponte IDE WebSocket | Ao alterar seleção ou diagnóstico na IDE com `liveSync = true`, o payload chega ao `desktop-app` respeitando o `debounceMs` e respeita a porta `wsPort`. |
| **CA-03** | Smart Frames | Dois frames consecutivos idênticos ou abaixo do limiar de diferença são descartados antes do envio à Gemini Live API; frames com mudança relevante disparam envio e registram economia de frames. |
| **CA-04** | TypeSafe AI (Zod) | Qualquer payload malformado da IA ou do WebSocket falha na validação Zod com erro tipado e fallback seguro, sem quebrar o HUD React. |
| **CA-05** | Persistência SQLite | Criar sessão, gravar interações e reabrir o `desktop-app` preserva o histórico completo em arquivo `.sqlite` local usando `node:sqlite`, sem módulos nativos compilados via `node-gyp`. |
| **CA-06** | Build & Typecheck | `npm run typecheck` e `npm run test` executam com código de saída `0` em todos os workspaces. |
