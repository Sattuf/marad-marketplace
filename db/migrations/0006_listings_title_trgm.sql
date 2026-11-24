-- listings-service falls back to `title ILIKE '%term%'` when Elasticsearch is not used.
-- A leading wildcard cannot use a B-tree index, so every such query scanned the whole
-- table (P9 in docs/REBUILD_PLAN.md). A trigram GIN index serves ILIKE '%term%' directly.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm ON listings USING gin (title gin_trgm_ops);
