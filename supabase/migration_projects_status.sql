-- Add status column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
