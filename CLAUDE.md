# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Tendo is an autonomous web QA agent. It replaces brittle E2E test scripts with plain-English prompts (e.g., "add item to cart and checkout"). It uses screenshot-based visual perception and coordinate-based element interaction via Playwright to navigate, act, and verify flows without relying on CSS selectors or DOM structure.

## Commands

```bash
# Build all packages and apps
npm run build --workspaces

# Build a specific workspace
npm run build --workspace=apps/cli

# Run CLI in dev mode (tsx, no compile step)
npm run dev --workspace=apps/cli

# Run built CLI
tendo test <url> -p "<prompt>"                  # headless test
tendo report <url> -p "<prompt>"                # run test + generate HTML report
tendo report <url> -p "<prompt>" --watch        # visible browser + screenshots + HTML report
tendo config                                    # view/edit provider settings
```

No test runner is configured — tests do not exist yet.

## Monorepo Structure

npm workspaces: `apps/*` and `packages/*`. All packages are ESM TypeScript targeting NodeNext.

**Dependency chain:**
- `apps/cli` → `@tendo/agent`, `@tendo/core`
- `@tendo/agent` → `@tendo/browser`, `@tendo/vision`, `@tendo/core`
- `@tendo/vision` → `@tendo/prompt-engine`, `@tendo/core`
- `@tendo/browser` → `@tendo/core`

**Package responsibilities:**
- `packages/core` — shared types (`Action`, `AgentState`, `PageContext`, `VisionDecision`), `Logger`, `LLMProvider` interface
- `packages/browser` — `BrowserPool` (chromium lifecycle) + `PageInteractor` (screenshot capture, 40-element DOM detection returning center coordinates, action execution)
- `packages/agent` — `AgentRunner`: event-driven loop (max 30 steps), loop detection via fuzzy action fingerprinting + screenshot pixel sampling
- `packages/vision` — `VisionClient`: orchestrates `PromptEngine` + `LLMProvider` to produce `VisionDecision` (thought + action)
- `packages/prompt-engine` — constructs structured prompts from screenshot, detected elements, and action history
- `apps/cli` — Commander CLI, provider factory (`src/agent/config.ts`), three commands: `test`, `report` (live run + HTML generation, `--watch` for visible browser), `config`

## Agent Loop

Each step: `PageInteractor` captures screenshot + detects elements → `VisionClient` calls LLM → `AgentRunner` executes returned `Action` → repeat until `done`/`fail`/max steps. Actions: `click` (x/y), `type` (x/y + text), `scroll` (direction/amount), `navigate` (url), `wait`, `done` (reason), `fail` (message).

## LLM Providers

Configured via env vars read through `dotenv` in `apps/cli/src/index.ts`:

| Var | Default | Notes |
|-----|---------|-------|
| `LLM_PROVIDER` | `gemini` | `"gemini"` or `"groq"` |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | — | Required for Gemini |
| `GROQ_API_KEY` | — | Required for Groq |
| `GEMINI_MODEL` | `gemini-2.5-flash` | |
| `GROQ_MODEL` | `meta-llama/llama-4-scout-17b-16e-instruct` | |

Gemini uses JSON schema response validation; Groq falls back to manual JSON parsing.

## Commit Conventions

Format: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `refactor`, `chore`
Scopes: `cli`, `browser`, `agent`, `vision`, `core`, `prompt-engine`

## Important Notes

- `.archive/` contains deprecated Python/Next.js code — ignore it.
- CLI output quality matters: use `@clack/prompts` and `picocolors` patterns already established; avoid placeholder implementations.
- `packages/browser/src/PageInteractor.ts` limits element detection to 40 visible interactive elements with exact center coordinates — this is intentional for LLM token budget.
