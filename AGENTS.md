# AI Agent Development Guidelines (AGENTS.md)

This project is built to be "Agent-First." These guidelines help AI coding assistants understand the project context and development patterns for Tendo.

## Project Debrief
**Tendo** is an autonomous web QA agent. It replaces brittle E2E test scripts with plain-English descriptions (e.g., "add item to cart and checkout"). It uses visual perception, semantic scraping, and an underlying browser to navigate, act, and verify flows.

## Structure
- `cli/` (TypeScript): The active core. Contains the agent loop (`src/agent/`), robust Playwright scraping layer (`src/scraper/`), and command orchestration.
- `archive/`: Deprecated Python API and Next.js frontend code. Ignore for current development.

## Core Principles
1. **Aesthetics & DX**: CLI output must be premium and user-friendly. Avoid placeholders; code features fully.
2. **Safety & Stability**: Ensure agent actions handle popups, retries, and browser state robustly. Verify before running destructive operations.
3. **Conventional Commits**: Use format `<type>(<scope>): <subject>` (Types: `feat`, `fix`, `refactor`, `chore`, etc. Scopes: `cli`, `scraper`, `agent`, `core`).

## Workflow Rules
- Read and match existing code architecture (use code search before implementing new abstractions).
- Run tools like standard linters before committing.
- Do not run commands unless they're explicitly stated.
