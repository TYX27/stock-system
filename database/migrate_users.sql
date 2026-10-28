-- Run this if database already exists (without wiping data):
-- docker compose exec db psql -U stock -d stock_inventory -f - < migrate_users.sql
-- Or: docker compose exec -T db psql -U stock -d stock_inventory < database/migrate_users.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name VARCHAR(150) DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO users (username, password_hash, display_name, role)
VALUES (
  'admin',
  crypt('admin123', gen_salt('bf')),
  'Administrator',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
