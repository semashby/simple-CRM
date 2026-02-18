-- Update the source of contacts to match their project name
-- Only for contacts where source is 'CSV Import' and a project is assigned

UPDATE contacts c
SET source = p.name
FROM projects p
WHERE c.project_id = p.id
AND c.source = 'CSV Import';
