-- =====================================================
-- Migration: Calendar Connections & Events
-- Run this in the Supabase SQL Editor
-- Adds Google Calendar sync support per user
-- =====================================================

-- 1. Calendar connections (one per user per provider)
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'google',  -- 'google', 'outlook', etc.
  calendar_id TEXT,                          -- chosen calendar ID (e.g. 'primary', email)
  calendar_name TEXT,                        -- display name of the calendar
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Synced calendar events (cached from external calendar)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES calendar_connections(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  external_id TEXT NOT NULL,                 -- Google event ID
  title TEXT NOT NULL DEFAULT '(No title)',
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  status TEXT DEFAULT 'busy',                -- 'busy', 'free', 'tentative'
  synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON calendar_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_connection ON calendar_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_external ON calendar_events(connection_id, external_id);

-- 4. RLS
ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can manage their own connections
DO $$ BEGIN
  CREATE POLICY "Users can manage own calendar connections"
    ON calendar_connections FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Everyone can read calendar events (for team availability)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view all calendar events"
    ON calendar_events FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can manage their own events (insert/update/delete from sync)
DO $$ BEGIN
  CREATE POLICY "Users can manage own calendar events"
    ON calendar_events FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Auto-update updated_at on calendar_connections
CREATE TRIGGER calendar_connections_updated_at
  BEFORE UPDATE ON calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
