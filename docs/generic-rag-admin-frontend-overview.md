# Generic RAG Admin Frontend — Overview

Architectural context for this repository (`ai-dial-generic-rag-frontend`). Read this before working
on new features.

## What it is

This app is being built into the **Generic RAG admin application** — the configuration UI for a
Generic RAG DIAL application (metadata schema, parsers, indexes, retriever, generation, and the
documents collection). It is an admin/config surface, not the end-user chat experience.

## Integration model

- The admin frontend is **hosted on its own separate host**, independent of DIAL Admin.
- It is **injected into DIAL Admin through an `iframe`**. DIAL Admin is the host shell; this app is
  the embedded micro frontend.
- **DIAL Admin opens the iframe with parameters.** The app receives its context (e.g. which
  application/config to edit and the credentials to authenticate with) from the host rather than
  owning its own navigation or login. The embedding therefore requires:
  - an **auth process** that obtains/propagates credentials from the host, and
  - support for the **communication protocol** DIAL Admin uses to drive the embedded iframe.
- Because it is embedded and edit-only, it operates on **one application's config at a time** and has
  no standalone shell of its own.

## Hard requirement — UI kit

This admin frontend **must be built with `@epam/ai-dial-ui-kit` (ai-ui-kit) components.** Prefer the
kit's `Dial*` components over raw HTML elements. Discover components, props, and design tokens
through the `ai-dial-ui-kit` MCP server rather than by grepping `node_modules` (see `AGENTS.md`).
