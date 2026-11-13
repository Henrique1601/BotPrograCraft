# ADR-003: Persistência Local com `node:sqlite` Nativo do Node 24

- **Status:** Aceita
- **Data:** 2026-11-13
- **Contexto:** O BotPrograCraft precisa persistir localmente o histórico de sessões de tutoria, transcrições, trocas de `TutorMode`, metadados de contexto da IDE e métricas de uso sem exigir servidor de banco de dados externo nem etapas frágeis de compilação nativa (`node-gyp`, Python, Visual Studio Build Tools) no ambiente do usuário ou no Electron.

## Decisão

Adotar o módulo embutido **`node:sqlite`** (`DatabaseSync`) introduzido e estabilizado no **Node.js 24+** (e disponível nos runtimes compatíveis do ecossistema) como mecanismo único de persistência relacional local.

## Alternativas Consideradas

- **`better-sqlite3` ou `sqlite3`:** Rejeitados por dependerem de addons nativos C++ recompilados via `node-gyp` / `electron-rebuild`, fonte recorrente de falhas no Windows e em atualizações de versão do Electron/Node.
- **Arquivos JSON planos:** Rejeitados por falta de atomicidade em escritas concorrentes, dificuldade de consulta por sessão/data e degradação de performance conforme o histórico cresce.
- **IndexedDB no Renderer:** Rejeitado por acoplar a persistência ao processo de interface do Electron, dificultando acesso direto pelo processo principal (`main`) e testes unitários em Node puro.

## Consequências

- **Positivas:** Zero dependências nativas C++ externas no `package.json`; API síncrona simples, rápida e transacional; testes de repositório executáveis diretamente com `node --test` sem setup de banco.
- **Negativas:** Exige runtime compatível com `node:sqlite` (Node 24+ ou Electron com versão de Node correspondente); eventuais recursos avançados de extensões SQLite de terceiros não estão disponíveis por padrão.
