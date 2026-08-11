<h1 align="center">
    AI DIAL Generic RAG Frontend
</h1>
<p align="center">
    <a href="https://dialx.ai/">
        <img src="https://dialx.ai/logo/dialx_logo.svg" alt="About DIALX">
    </a>
</p>
<h4 align="center">
    <a href="https://discord.gg/ukzj9U9tEe">
        <img src="https://img.shields.io/static/v1?label=DIALX%20Community%20on&message=Discord&color=blue&logo=Discord&style=flat-square" alt="Discord">
    </a>
</h4>

Frontend for Generic RAG, a DIAL application that answers user questions based on data from a collection of preloaded and pre-indexed documents.

## Environment variables

All variables are server-only, read at **runtime** via `process.env` (no `NEXT_PUBLIC_*` build-time
constants). `DIAL_ADMIN_URL`/`DIAL_APPLICATION_NAME` are read in
[`layout.tsx`](./src/app/layout.tsx) and passed down through
[`EmbeddingContext`](./src/context/EmbeddingContext.tsx) so they're available to client components
without being baked into the client bundle at build time. `ALLOWED_FRAME_ANCESTORS` is read
server-side by [`proxy.ts`](./src/proxy.ts).

| Variable                  | Default         | Required            | Purpose                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOWED_FRAME_ANCESTORS` | `'none'`        | Yes (for embedding) | Origin(s) allowed to frame this app via CSP `frame-ancestors` (e.g. the deployed DIAL Admin origin). Left unset, the app refuses to be framed — no error, the iframe just won't render.                                                                                          |
| `DIAL_ADMIN_URL`          | —               | No                  | DIAL Admin origin, used as a fallback to resolve the embedding parent when `window.location.ancestorOrigins`/`document.referrer` are unavailable (e.g. local dev, standalone visits).                                                                                            |
| `DIAL_APPLICATION_NAME`   | `'Generic RAG'` | No                  | Visualizer name used to namespace postMessage events with DIAL Admin when the `id` query param isn't present in the embedding URL. Should match the app's display name in DIAL config.                                                                                           |
| `DIAL_API_URL`            | —               | Yes                 | Base origin of DIAL Core, used to reach the channel API through its deployment route (`/v1/deployments/{application_id}/route/channel/**`).                                                                                                                                      |
| `THEMES_CONFIG_URL`       | —               | No                  | Base URL of the DIAL themes config service, queried as `${THEMES_CONFIG_URL}/config.json` for the theme id → color palette used to render the `theme` embedding query param for real. Left unset or unreachable, theming falls back to whatever's baked into this app's own CSS. |

### Authentication

Auth is optional and off by default — the app runs unguarded unless `NEXTAUTH_URL` is set. When
enabling it, configure `NEXTAUTH_URL`/`NEXTAUTH_SECRET` plus **exactly one** identity provider's
variables; see [`docs/authentication.md`](./docs/authentication.md) for the full per-provider
variable reference (Keycloak, Azure AD, Google, Auth0, Amazon Cognito, Okta).

| Variable           | Default        | Required              | Purpose                                                                                                   |
| ------------------ | -------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| `NEXTAUTH_URL`     | —              | Yes (to enable auth)  | Canonical deployment URL NextAuth uses for callback URLs and to detect https. Its presence turns auth on. |
| `NEXTAUTH_SECRET`  | —              | Yes (if auth enabled) | Secret NextAuth uses to sign/encrypt session JWTs.                                                        |
| `ADMIN_ROLE_NAMES` | `'admin'`      | No                    | Comma-separated role names that grant admin access.                                                       |
| `DIAL_ROLES_FIELD` | `'dial_roles'` | No                    | Dot-separated JWT claim path the user's roles are read from.                                              |
| `SHOW_TOKEN_SUB`   | `false`        | No                    | Debug toggle — logs the token `sub` claim in the clear instead of masking it.                             |

## DIAL Admin embedding

This app can be embedded as an iframe inside DIAL Admin's application editor UI. The integration
is a generic, data-driven mechanism — not something registered by name in either side's code:

1. DIAL Admin builds the iframe URL from the Application resource's configured editor URL, plus
   query params: `<editorUrl>?authProvider=<providerId>&theme=<theme>&id=<appId>`.
2. On load, this app reads those query params (`src/hooks/use-embedding-bridge.ts`), applies
   `theme`, and opens a `ChatVisualizerConnector` (from `@epam/ai-dial-chat-visualizer-connector`)
   back to the parent origin, sending `READY` then `READY_TO_INTERACT`. DIAL Admin clears its
   loading state once it receives `READY_TO_INTERACT`.
3. Because DIAL Admin may namespace messages by either the `id` query param or the app's
   configured display name, the ready handshake (and all subsequent messages) is broadcast under
   both candidate names.
4. An optional dirty-state protocol is wired up as plumbing (`EmbeddingContext.reportDirtyState`/
   `onSaveRequested`): this app can report unsaved changes so DIAL Admin warns before switching
   tabs away, and DIAL Admin can request a save before doing so. No feature currently uses this —
   it's available for a future editable view to hook into.
5. The app must allow being framed via the CSP `frame-ancestors` directive
   (`ALLOWED_FRAME_ANCESTORS`), which defaults to refusing all framing.

**DIAL Core-side prerequisite (outside this repo):** for the iframe to actually render, the
Application resource (or its Application Type Schema) must have its editor URL field set to this
app's deployed origin, and its display name must match `DIAL_APPLICATION_NAME` above so the
handshake namespacing lines up. This is DIAL Core configuration data, not code in this repository.

## Run locally

```bash
npm install
cp .env.template .env.local
npm run dev    # http://localhost:3000
```

See [`AGENTS.md`](./AGENTS.md#commands-reference) for the full commands reference (build, lint,
test, etc).
