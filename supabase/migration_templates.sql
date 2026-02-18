-- =====================================================
-- Migration: Add Templates & Scripts Tables
-- Run this in the Supabase SQL Editor
-- =====================================================

-- 1. Call Scripts table
CREATE TABLE IF NOT EXISTS call_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Email Templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- 4. All authenticated users can read
DO $$ BEGIN
  CREATE POLICY "Anyone can view call_scripts"
    ON call_scripts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can view email_templates"
    ON email_templates FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Admins can insert/update/delete (enforced in frontend)
DO $$ BEGIN
  CREATE POLICY "Authenticated can manage call_scripts"
    ON call_scripts FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can manage email_templates"
    ON email_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_call_scripts_created ON call_scripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_templates_created ON email_templates(created_at DESC);
