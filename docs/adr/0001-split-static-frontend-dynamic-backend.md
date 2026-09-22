# 0001. Split static frontend on GitHub Pages and dynamic FastAPI backend

## Context

We need zero-cost global CDN hosting for the public blog while providing vector retrieval, LLM Q&A, and private knowledge base access. GitHub Pages only serves static files and cannot execute server-side processes or store private embeddings.

## Decision

We deploy a Vue 3 Single-Page Application (SPA) statically to GitHub Pages, while running an independent FastAPI service on an external server. Public browsing is served by static assets and public APIs; private Document retrieval and RAG Q&A require JWT authentication against the FastAPI backend.

## Consequences

- Frontend assets benefit from GitHub's global edge caching without server maintenance costs.
- Requires cross-origin API handling (CORS) between GitHub Pages domain and the FastAPI backend.
- Private Documents and sensitive embeddings are strictly kept in the backend database and never compiled into frontend static bundles.
