CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  image_name TEXT,
  s3_url TEXT,
  result JSONB,
  confidence NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
