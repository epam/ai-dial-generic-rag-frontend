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

`NEXT_PUBLIC_` - prefixed variables are inlined into the client bundle at **build** time (standard
Next.js behavior — see [`EmbeddingBridge.tsx`](./src/components/embedding/EmbeddingBridge.tsx) for
where they're consumed). Un-prefixed variables are server-only and read at **runtime** (e.g. by
[`proxy.ts`](./src/proxy.ts)).

| Variable                            | Scope            | Default         | Required            | Purpose                                                                                                                                                                                 |
| ----------------------------------- | ---------------- | --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOWED_FRAME_ANCESTORS`           | Runtime (server) | `'none'`        | Yes (for embedding) | Origin(s) allowed to frame this app via CSP `frame-ancestors` (e.g. the deployed DIAL Admin origin). Left unset, the app refuses to be framed — no error, the iframe just won't render. |
| `NEXT_PUBLIC_DIAL_ADMIN_URL`        | Build (client)   | —               | No                  | DIAL Admin origin, used as a fallback to resolve the embedding parent when `window.location.ancestorOrigins`/`document.referrer` are unavailable (e.g. local dev, standalone visits).   |
| `NEXT_PUBLIC_DIAL_APPLICATION_NAME` | Build (client)   | `'Generic RAG'` | No                  | Visualizer name used to namespace postMessage events with DIAL Admin when the `id` query param isn't present in the embedding URL.                                                      |

## Run locally

```bash
npm install
cp .env.template .env.local
npm run dev    # http://localhost:3000
```

See [`AGENTS.md`](./AGENTS.md#commands-reference) for the full commands reference (build, lint,
test, etc).
