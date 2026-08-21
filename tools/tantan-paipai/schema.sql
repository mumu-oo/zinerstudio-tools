CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  created_at INTEGER NOT NULL,
  password_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_updated ON workspaces(updated_at);

-- migration: 加 password_hash 欄位（如果表存在但沒有）
-- D1 沒有 ADD COLUMN IF NOT EXISTS、要手動判斷、但空表沒差

