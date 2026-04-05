# Agent Guidelines

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/) for clear and structured commit history.

### Format

```
<type>: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type     | Description                                          | Example                                      |
|----------|------------------------------------------------------|----------------------------------------------|
| `feat`   | A new feature or functionality                       | `feat: add user authentication`              |
| `fix`    | A bug fix                                            | `fix: resolve login redirect issue`          |
| `bug`    | Bug-related changes (alternative to fix)             | `bug: correct validation error on signup`    |
| `chore`  | Maintenance tasks, build changes, dependencies       | `chore: update dependencies`                 |
| `doc`    | Documentation changes only                          | `doc: add API usage examples`                |

### Rules

- **Description**: Use lowercase, present tense, no period at the end
- **Body**: Explain what and why, not how (when needed)
- **Breaking changes**: Add `!` after type or include `BREAKING CHANGE:` in footer

### Examples

```
feat: implement dark mode toggle

feat!: redesign dashboard layout

fix: prevent crash on empty input array

doc: update README with environment setup

chore: bump typescript to v5.4
```

---

## Folder Structure

```
.
├── .vscode/                # VS Code configuration
├── apps/
│   ├── api/                # Python FastAPI backend
│   │   ├── app/
│   │   │   ├── routes/     # API route handlers
│   │   │   └── services/   # Business logic services
│   │   └── ...
│   └── web/                # Next.js frontend
│       ├── app/            # Next.js App Router
│       │   └── (root)/       # Route group
│       │       └── test/
│       │           └── [sessionId]/
│       ├── components/
│       │   ├── landing/    # Landing page components
│       │   └── ui/         # Shared UI components
│       ├── hooks/          # Custom React hooks
│       ├── lib/            # Utility functions
│       └── public/         # Static assets
├── .gitignore
├── AGENTS.md               # This file
└── README.md
```

### Guidelines

- **Flat is better than nested** — avoid deep folder hierarchies
- **Colocate related files** — keep tests, styles, and types close to their components
- **Domain-based grouping** — organize by feature/domain when projects scale

