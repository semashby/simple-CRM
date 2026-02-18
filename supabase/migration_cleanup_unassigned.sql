-- 1. Check how many contacts are unassigned (orphaned)
SELECT count(*) FROM contacts WHERE project_id IS NULL;

-- 2. Delete all unassigned contacts
-- Uncomment the following line to execute the deletion
-- DELETE FROM contacts WHERE project_id IS NULL;
