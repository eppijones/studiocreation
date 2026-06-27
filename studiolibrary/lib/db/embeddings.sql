-- StudioLibrary — semantic search index (Phase 3). Pins the embedding dimension
-- (open_clip ViT-B-32 = 512) and builds the ANN index. Layered on schema.sql.
-- The embeddings table starts empty (the `embed` job was stubbed pre-Phase-3),
-- so pinning the dimension is safe.

-- Pin the vector dimension. Re-running is harmless (no-op rewrite on the same type).
ALTER TABLE embeddings ALTER COLUMN vector TYPE vector(512);

-- HNSW (pgvector >= 0.5): build-once, query-fast, cosine to match L2-normalized
-- CLIP vectors. Guarded so an older pgvector image degrades to lexical search
-- instead of failing the whole migration.
DO $$
BEGIN
  EXECUTE 'CREATE INDEX IF NOT EXISTS embeddings_hnsw_idx ON embeddings USING hnsw (vector vector_cosine_ops)';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'HNSW index not created (pgvector < 0.5?) — semantic search falls back to lexical: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS embeddings_modality_idx ON embeddings (modality);
