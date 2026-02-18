-- Delete all contacts for a specific project
-- Replace 'PROJECT_ID_HERE' with the actual UUID of the project

DELETE FROM contacts 
WHERE project_id = 'PROJECT_ID_HERE';

-- To find your project ID, you can run:
-- SELECT * FROM projects;
