CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS barcode_cache (
  barcode      TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  nutrition    JSONB NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now()
);
