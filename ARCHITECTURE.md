# Spryte Engine Architecture
## (Forked from OpenClaw v2026.2.12, MIT License)

## Overview
OpenClaw is a multi-channel AI gateway — it sits between messaging platforms (Discord, Telegram, Slack, WhatsApp, Signal, iMessage, IRC, etc.) and LLM providers (Anthropic, OpenAI, Google, Bedrock, etc.), routing messages through configurable AI agents with tool access.

## Entry Points
- `openclaw.mjs` / `nemo.mjs` — CLI entry point
- `src/entry.ts` — Main entry, bootstraps the gateway
- `dist/index.js` — Compiled output (what actually runs)

## Core Architecture

### 1. Gateway (`src/gateway/`)
The heart of the system. An HTTP/WebSocket server that:
- Binds to localhost, LAN, tailnet, or custom addresses
- Serves the Control UI (web dashboard)
- Handles WebSocket connections from CLI clients
- Routes inbound messages from channels to agents
- Manages sessions, tools, and browser control
- Key files: `server/`, `server-channels.ts`, `server-browser.ts`, `server-lanes.ts`

### 2. Agents (`src/agents/`)
The AI agent runtime:
- `agents/` — Agent lifecycle, model selection, tool dispatch
- `agents/tools/` — Tool implementations (exec, read, write, edit, browser, message, cron, etc.)
- `agents/sandbox/` — Docker container sandboxing for sub-agents
- `agents/skills/` — Skill loading and management
- `agents/auth-profiles/` — Multi-provider auth with failover
- `agents/pi-embedded-runner/` — Embedded agent execution (pi = "personal intelligence")
- `agents/cli-runner/` — CLI backend execution (codex, claude-code, etc.)

### 3. Sessions (`src/sessions/`)
Session management — conversation state, history, compaction:
- Per-sender sessions, global sessions, DM scoping
- Session reset (daily, idle-based)
- History storage (JSONL transcripts)
- Compaction (summarizing old context to save tokens)

### 4. Channels (`src/channels/`)
Abstract channel interface + per-platform implementations:
- `src/discord/` — Discord.js integration
- `src/telegram/` — Grammy bot framework
- `src/slack/` — Slack Bolt
- `src/whatsapp/` — Baileys (WhatsApp Web)
- `src/signal/` — Signal CLI bridge
- `src/imessage/` — macOS iMessage integration
- `src/line/` — LINE Bot SDK
- `src/channels/web/` — WebChat/Control UI channel
- `src/channels/plugins/` — Plugin-based channel loading

### 5. Config (`src/config/`)
JSON config loading, validation (TypeBox/AJV), and hot-reload:
- Schema defined with @sinclair/typebox
- Config file: `~/.nemo/nemo.json`
- Supports patching, validation, and restart-on-change

### 6. Browser (`src/browser/`)
Playwright-based browser control:
- CDP (Chrome DevTools Protocol) connection
- Multiple profiles (persistent sessions)
- Snapshot (accessibility tree extraction)
- Screenshot, navigation, click/type/press actions
- Routes via `browser/routes/`

### 7. Tools
Registered in `src/agents/tools/`:
- `exec` — Shell command execution (with approval flow)
- `read/write/edit` — File operations
- `browser` — Web browser control
- `message` — Cross-channel messaging
- `cron` — Scheduled jobs
- `web_search/web_fetch` — Web access
- `memory_search/memory_get` — Vector memory
- `image` — Vision model analysis
- `tts` — Text-to-speech
- `sessions_*` — Sub-agent management
- `canvas` — UI presentation
- `nodes` — Device control

### 8. Memory (`src/memory/`)
Vector search over markdown files:
- Chunking, embedding (OpenAI/Gemini/Voyage/local)
- SQLite + sqlite-vec for vector storage
- Hybrid BM25 + vector search

### 9. Cron (`src/cron/`)
Scheduled task execution:
- One-shot, recurring, cron expressions
- System events or isolated agent turns
- Persistent job store

### 10. Plugins (`src/plugins/`)
Extension system:
- Plugin SDK (`src/plugin-sdk/`)
- Channel plugins, auth plugins, memory plugins
- Hook system (`src/hooks/`) for webhooks/events
- Installable via npm or local paths

### 11. Media (`src/media/`, `src/media-understanding/`)
- Image/audio/video understanding via LLMs
- Link understanding (URL → content extraction)
- TTS (`src/tts/`) — ElevenLabs, OpenAI, Edge

### 12. Providers (`src/providers/`)
LLM provider abstraction:
- OpenAI (completions + responses API)
- Anthropic (messages API)
- Google (Generative AI)
- Bedrock (AWS)
- GitHub Copilot proxy

### 13. Infrastructure
- `src/infra/` — Shared infra (time formatting, etc.)
- `src/utils/` — Utility functions
- `src/shared/` — Shared types/constants
- `src/types/` — TypeScript type definitions
- `src/security/` — Security utilities
- `src/routing/` — Message routing logic
- `src/pairing/` — Device pairing (QR codes, setup codes)
- `src/daemon/` — LaunchAgent/systemd daemon management
- `src/cli/` — CLI command implementations
- `src/commands/` — Chat command handlers (/status, /model, etc.)
- `src/tui/` — Terminal UI
- `src/wizard/` — Setup wizard
- `src/terminal/` — Terminal rendering

## External Dependencies (51 runtime)
### Critical (can't easily replace)
- `playwright-core` — Browser automation
- `grammy` — Telegram bot
- `@slack/bolt` — Slack integration
- `@whiskeysockets/baileys` — WhatsApp Web
- `discord-api-types` — Discord types
- `ws` — WebSocket
- `express` — HTTP server
- `sqlite-vec` — Vector search
- `sharp` — Image processing
- `undici` — HTTP client

### Core Framework
- `@sinclair/typebox` — Config schema
- `ajv` — JSON validation
- `commander` — CLI framework
- `croner` — Cron scheduling
- `chokidar` — File watching
- `zod` — Runtime validation

### AI/Agent Core
- `@mariozechner/pi-agent-core` — Agent core runtime
- `@mariozechner/pi-ai` — AI provider abstraction
- `@mariozechner/pi-coding-agent` — Coding agent
- `@mariozechner/pi-tui` — Terminal UI components
- `@agentclientprotocol/sdk` — Agent Client Protocol

## Data Flow
```
User Message (Discord/Telegram/etc.)
  → Channel Plugin receives message
  → Gateway routes to Agent session
  → Agent builds context (system prompt + history + tools)
  → LLM Provider generates response (may include tool calls)
  → Tool calls executed (exec, browser, file ops, etc.)
  → Response sent back through Channel Plugin
  → User sees reply
```

## Critical: @mariozechner/pi-* Packages

These are the proprietary core packages OpenClaw depends on. All MIT licensed.

### pi-agent-core (v0.52.10) — THE BRAIN
- `Agent` class — stateful agent with tools, thinking, steering
- `agentLoop()` / `agentLoopContinue()` — the core loop: prompt → LLM → tool calls → repeat
- `AgentMessage`, `AgentEvent`, `AgentContext` — message/event types
- `AgentLoopConfig` — config for model, tools, context transform, steering
- ~977 lines JS, ~1400 total with types
- **This is what we must understand/replace for independence**

### pi-ai (v0.52.10) — LLM ABSTRACTION  
- `streamSimple()` — unified streaming interface to all LLM providers
- `Model`, `Message`, `Tool`, `TextContent`, `ImageContent` — core types
- Provider registry, API key management
- Model catalog (12K+ lines of generated model definitions)
- ~60K lines total

### pi-coding-agent (v0.52.10) — CODING TOOLS
- Coding-specific agent tools and workflows

### pi-tui (v0.52.10) — TERMINAL UI
- Terminal rendering, ink-based components

**Vendored copies saved to `vendor/pi-packages/` for reference.**

## File Counts
- ~490K lines of TypeScript in src/
- ~1,050 non-test .ts files in src/ (depth 2)
- 51 runtime dependencies
- 21 dev dependencies
