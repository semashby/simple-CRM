-- =====================================================
-- Migration: Add Profiles Table for Team Management
-- Run this in the Supabase SQL Editor
-- Creates a profiles table synced with auth.users
-- =====================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'agent',  -- 'admin' or 'agent'
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. Everyone can read profiles (team visibility)
DO $$ BEGIN
  CREATE POLICY "Anyone can view profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Users can update their own profile
DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Allow inserts for new signups
DO $$ BEGIN
  CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(
        TRIM(
          COALESCE(NEW.raw_user_meta_data ->> 'first_name', '') || ' ' ||
          COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
        ), ''
      ),
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.email
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- 7. Backfill: create profiles for existing users
INSERT INTO profiles (id, email, full_name)
SELECT id, email, COALESCE(raw_user_meta_data ->> 'full_name', email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 8. Index
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
