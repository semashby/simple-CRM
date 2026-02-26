-- Migration: Create project_members junction table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS project_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, project_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

-- Enable RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can read their own memberships
CREATE POLICY "Users can view their own memberships"
    ON project_members FOR SELECT
    TO authenticated
    USING (true);

-- Policy: admins can manage memberships
CREATE POLICY "Admins can manage memberships"
    ON project_members FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
