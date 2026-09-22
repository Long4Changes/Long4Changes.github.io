# 0003. PostgreSQL with pgvector for relational and vector partitioning

## Context

The platform requires vector semantic search, hybrid keyword matching, and strict access filtering between public and private content. Using separate vector and relational databases introduces dual-write synchronization complexity and distributed security boundaries.

## Decision

We use a single PostgreSQL instance with the `pgvector` extension. Both Document metadata (title, slug, date, visibility) and text Chunk embeddings reside in relational tables, allowing vector similarity searches to enforce `WHERE visibility = 'public'` in a single atomic SQL query.

## Consequences

- Eliminates synchronization drift between relational and vector stores.
- Access control is enforced at the database query level rather than in post-retrieval application filters.
- Native compatibility with Python SQLModel/asyncpg and LangChain pgvector connectors.
