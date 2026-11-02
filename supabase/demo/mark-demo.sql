-- Run this ONCE, and ONLY on the separate public demo project, after its migrations.
-- scripts/seed-demo.mjs wipes all data, and refuses to run unless this table exists.
-- Never run this on the production database.
CREATE TABLE IF NOT EXISTS public.demo_environment (
  marked_at TIMESTAMP WITH TIME ZONE PRIMARY KEY DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.demo_environment ENABLE ROW LEVEL SECURITY;
