-- =====================================================
-- Fix: Admin Permissions & Role Management
-- Run this in Supabase SQL Editor to fix "Permission Denied" errors
-- =====================================================

-- 1. Allow Super Admins to update ANY profile (e.g. changing roles)
DO $$ BEGIN
  CREATE POLICY "Super Admins can update any profile"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    )
    WITH CHECK (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Allow Super Admins to delete profiles
DO $$ BEGIN
  CREATE POLICY "Super Admins can delete profiles"
    ON profiles
    FOR DELETE
    TO authenticated
    USING (
      (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Ensure Contacts are editable by Admins/Super Admins and Assignees
-- (Dropping existing simple policy to be more specific if needed, 
-- but if the existing policy is "ALL for authenticated", it already covers this. 
-- The user's issue with contacts might just be missing tables if migration wasn't run.
-- We'll assume the simple "ALL" policy from schema.sql is sufficient if it exists. 
-- Use this ONLY if you need stricter control. For now, we trust schema.sql's ALL policy.)

-- 4. Check if call_logs/reminders exist (User had 404s).
-- If you see 404s, it means tables are missing.
-- Please make sure to run: migration_call_logs.sql AND migration_templates.sql
