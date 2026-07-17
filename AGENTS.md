# AI agents — Generic RAG Frontend

This file is read by Claude Code, Cursor, Codex, and other agent harnesses alongside
project context. It defines how AI assistants should work in this repository.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent principles

1. **Read before edit** — Open related files before changing behavior or API.
2. **Minimal diffs** — Solve the task only; no unrelated refactors.
3. **Verify** — After substantive changes run `npm run lint`, `npm run test`, and `npm run build`.
4. **Security** — Do not commit secrets; treat `.env*` files as sensitive. When adding a new
   `process.env`, update `.env.template`.

## Code conventions

- **Imports**: use the `@/*` path alias (maps to `src/*`); avoid relative `../../` traversal
  across boundaries.
- **Styling**: Tailwind utility classes only. Compose existing utilities rather than introducing
  custom CSS or new utility classes — only add one as an absolute last resort when Tailwind has no
  way to express what's needed.
- **UI**: prefer `@epam/ai-dial-ui-kit` `Dial*` components over raw HTML elements.

## When working with @epam/ai-dial-ui-kit

The `ai-dial-ui-kit` MCP server (tools `searchEntity` / `getEntityDetails`) is the preferred way to
discover components and exact prop signatures. **If that MCP server is not available in your
session**, read the type definitions directly from
`node_modules/@epam/ai-dial-ui-kit/dist/src/**/*.d.ts` instead.

## Commands reference

| Script                 | Use                                        |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Local dev server                           |
| `npm run build`        | Production build                           |
| `npm run start`        | Serve production build (run `build` first) |
| `npm run lint`         | ESLint                                     |
| `npm run lint:fix`     | ESLint with autofix                        |
| `npm run format`       | Prettier check                             |
| `npm run format:write` | Prettier write                             |
| `npm run test`         | Run Vitest tests                           |
