<p align="center">
  <img alt="Tendo" src="https://raw.githubusercontent.com/ian-yeh/tendo/main/assets/logo.svg" width="128">
</p>

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
tendo test <url> -p "<prompt>"     # Run a headless test and report result
tendo watch <url> -p "<prompt>"    # Visible browser + screenshots saved to ~/.tendo/watch/
```

### `tendo test`

The core command. Provide a starting URL and a plain English description of the flow you want to verify. Tendo spins up a headless browser, executes the steps autonomously using visual perception, and reports whether the flow succeeded or failed.

```bash
tendo test https://example-store.com -p "Add the first featured item to the cart and proceed to checkout"
```

### `tendo watch`

Runs the same agent as `test` but in debug mode — the browser is visible so you can watch the agent navigate, click, and type in real-time. Each step's screenshot is saved to disk for post-run review.

```bash
tendo watch https://todomvc.com -p "Add three todos and mark the first one complete"
```

Screenshots are saved to `~/.tendo/watch/<session>/<timestamp>/`:

```
~/.tendo/watch/
  └─ 1/
      └─ 2026-04-30T02-10-00/
          ├─ step-01.png
          ├─ step-02.png
          └─ step-03.png
```

## Development

```bash
npm install                          # Install all dependencies
npm run build --workspaces           # Build all packages
npm run dev --workspace=apps/cli     # Run CLI in dev mode (no compile step)
```

---

<p align="center"><em>built by Ian Yeh</em></p>
