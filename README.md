<h1 align="center">Tendo</h1>

<p align="center">
  Autonomous QA agent that tests your web app the way a person would.
</p>

<p align="center">
  No test scripts. No selectors. No maintenance.
</p>

---

## What it does

You give Tendo a URL and a prompt like "add an item to the cart and check out". It takes it from there — navigating, clicking, typing, scrolling — and at each step, it looks at what's actually on the screen to decide what to do next. When it's done, it tells you whether the flow succeeded or where it broke. It's less like a test runner and more like a QA engineer who never gets tired.

## Why

Most E2E testing tools require you to write and maintain brittle scripts that break every time your UI changes. Tendo describes intent, not implementation. If your button moves, Tendo adapts. If your flow changes, you update one sentence.

## Commands

```bash
tendo test <url> -p "<prompt>"           # Headless test — pass/fail result
tendo report <url> -p "<prompt>"         # Run a test and generate an HTML report
tendo report <url> -p "<prompt>" --watch # Visible browser + screenshots + HTML report
tendo config                             # View and edit provider settings
```

### `tendo test`

The core command. Provide a starting URL and a plain English description of the flow you want to verify. Tendo spins up a headless browser, executes the steps autonomously using visual perception, and reports whether the flow succeeded or failed.

```bash
tendo test https://example-store.com -p "Add the first featured item to the cart and proceed to checkout"
```

### `tendo report`

Runs a test and generates a self-contained HTML report with screenshots, step-by-step reasoning, and a pass/fail summary. Add `--watch` to run with a visible browser and save per-step screenshots to disk for debugging.

```bash
# Run headless and open the HTML report
tendo report https://todomvc.com -p "Add three todos and mark the first one complete"

# Visible browser + per-step screenshots + HTML report
tendo report https://todomvc.com -p "Add three todos and mark the first one complete" --watch

# Generate a report from a previous session
tendo report           # latest session
tendo report 3         # session number
tendo report ./result.json
```

When using `--watch`, per-step screenshots are saved to `~/.tendo/watch/<session>/<timestamp>/`.

### `tendo config`

View and edit your LLM provider configuration — API keys, model selection, and provider choice.

## Development

```bash
npm install                          # Install all dependencies
npm run build --workspaces           # Build all packages
npm run dev --workspace=apps/cli     # Run CLI in dev mode (no compile step)
```

---

<p align="center"><em>built by Ian Yeh</em></p>
