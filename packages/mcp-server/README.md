# @botprogracraft/mcp-server

Stdio Model Context Protocol (MCP) server for **BotPrograCraft**. It exposes your live IDE context, latest captured screen frame, tutoring mode prompts, and SQLite learning progress to **Antigravity IDE** (or any MCP-compatible client).

## Prerequisites

Build the shared packages and the MCP server from the monorepo root:

```bash
npm run build:shared
npm run build --workspace=@botprogracraft/ai-core
npm run build --workspace=@botprogracraft/storage
npm run build --workspace=@botprogracraft/mcp-server
```

## Antigravity IDE Configuration

Add the following entry to your Antigravity IDE MCP configuration (`mcp_config.json`):

```json
{
  "mcpServers": {
    "botprogracraft": {
      "command": "node",
      "args": [
        "C:/Users/Public/Downloads/BotPrograCraft/packages/mcp-server/dist/index.js"
      ],
      "env": {
        "BOTPROGRACRAFT_HOME": ""
      }
    }
  }
}
```

> **Note:** Replace the `args` path with your local clone path if different. Omit `env.BOTPROGRACRAFT_HOME` (or leave it unset) to use the default `~/.botprogracraft/` directory shared with `@botprogracraft/desktop-app`.

## Exposed MCP Tools

| Tool | Description |
| --- | --- |
| `get_live_ide_context` | Returns the latest `IdeContextPayload`, active `tutorMode`, and `updatedAt` from `live-state.json`. |
| `get_live_screen` | Returns the latest captured screen frame (`latest-frame.jpg`) as an MCP `image` content block (`image/jpeg`) plus dimensions and timestamp metadata. Supports `captureNow: true` and automatically falls back to on-demand Windows screen capture when no cached frame exists. |
| `get_tutor_prompt` | Generates a BotPrograCraft system prompt for a given `TutorMode` (`socratic`, `pair-programming`, `explain-bug`, `logic-challenge`, `direct`) via `@botprogracraft/ai-core`. |
| `record_exercise_attempt` | Validates an exercise evaluation with Zod and persists it to `botprogracraft.db` via `ProgressRepository.recordAttempt`. |
| `get_learning_progress` | Returns aggregate stats (`getStats()`), the 5 most recent exercise attempts (`listRecentAttempts(5)`), and the top 5 recurring errors (`getTopRecurringErrors(5)`). |
| `run_exercise_check` | Executes JavaScript, TypeScript, or Python code against stdin/stdout test cases via `@botprogracraft/ai-core` and optionally records the attempt to `botprogracraft.db`. |
