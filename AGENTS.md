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
- **Tests**: place `*.test.ts`/`*.test.tsx` files in a `__tests__` subfolder next to the code they
  cover (e.g. `src/utils/embedding/__tests__/apply-theme.test.ts`), not colocated directly beside
  the source file. Import the code under test via the `@/*` alias, not a relative path.
- **Hooks**: name hook files kebab-case (e.g. `src/hooks/use-auth.ts`,
  `src/hooks/use-embedding-bridge.ts`) — the exported hook itself stays camelCase (`useAuth`,
  `useEmbeddingBridge`) per React convention; only the filename is kebab-case, consistent with the
  rest of `src/`.
- **Logging**: always use `createLogger(scope)` from `@/utils/logger`, never raw `console.*`.
  Create one shared scoped logger per domain and import it everywhere in that domain, rather than
  calling `createLogger` again in each file (e.g. `utils/auth/logger.ts` exports `authLogger`,
  reused by every file under `utils/auth/`).
- **Constants**: domain-wide constants that are meaningful outside their owning file go in
  `src/constants/<domain>.ts` (e.g. `src/constants/auth.ts`), not colocated with the logic that
  uses them.

## When working with @epam/ai-dial-ui-kit

The `ai-dial-ui-kit` MCP server enables you to discover components, read exact prop signatures,
access code examples, and understand design tokens and available utilities.

Use these two tools for all UI kit discovery and documentation needs: `searchEntity(entity, query?)`
and `getEntityDetails(entity, name?)`. If you need to look up **ANYTHING** about the ui kit, use the
MCP server.

> **Note:** Do not use `grep`, `glob`, `find`, or similar file system tools to discover components.
> The MCP tools provide accurate, structured metadata. File system searches miss examples, miss
> type information, and are slower.

**If the MCP server is not available in your session**, read the type definitions directly from
`node_modules/@epam/ai-dial-ui-kit/dist/src/**/*.d.ts` instead.

## DIAL Admin iframe embedding

`src/hooks/use-embedding-bridge.ts` (logic) plus `src/components/embedding/EmbeddingBridge.tsx`
(the `Suspense`-boundary host) and `src/utils/embedding/` wire up this app's side of being embedded
as an iframe in DIAL Admin (reads `theme`/`authProvider`/`id` query params, sends the
`ChatVisualizerConnector` ready handshake). **Auth is intentionally not implemented
here** — the embedded app is expected to eventually authenticate independently (its own
OIDC/session, not a token passed through the iframe), but that work has not started yet. Anything
that assumes an authenticated session inside this app is not yet safe to build on.

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
