-- =====================================================
-- CRM Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. ENUMS
CREATE TYPE contact_status AS ENUM (
  'new',
  'contacted',
  'meeting_scheduled',
  'proposal_sent',
  'negotiation',
  'client',
  'lost'
);

CREATE TYPE activity_type AS ENUM (
  'call',
  'email',
  'meeting',
  'note',
  'status_change'
);

-- 2. PROJECTS TABLE (Lead Lists)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CONTACTS TABLE
CREATE TABLE contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  phone TEXT,
  function TEXT,
  company_name TEXT,
  branch TEXT,
  linkedin_url TEXT,
  website TEXT,
  location TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'Manual',
  status contact_status DEFAULT 'new',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. NOTES TABLE
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ACTIVITIES TABLE
CREATE TABLE activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  type activity_type NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. REMINDERS TABLE
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  due_date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. INDEXES
CREATE INDEX idx_contacts_project ON contacts(project_id);
CREATE INDEX idx_contacts_status ON contacts(status);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_notes_contact ON notes(contact_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_reminders_contact ON reminders(contact_id);
CREATE INDEX idx_reminders_due ON reminders(due_date) WHERE is_done = false;

-- 8. AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 9. ROW LEVEL SECURITY
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to do everything (team-wide access)
CREATE POLICY "Authenticated users can manage projects"
  ON projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage contacts"
  ON contacts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage notes"
  ON notes FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage activities"
  ON activities FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage reminders"
  ON reminders FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
