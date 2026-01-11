-- First, let's see what duplicates we have
WITH duplicates AS (
  SELECT 
    name,
    COUNT(*) as count,
    ARRAY_AGG(id ORDER BY created_at) as ids,
    ARRAY_AGG(created_at) as created_dates
  FROM achievements
  GROUP BY name, tournament_id
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicates;

-- Now, let's create a backup of the duplicate rows just in case
CREATE TABLE achievements_duplicates_backup AS
SELECT a.*
FROM achievements a
JOIN (
  SELECT name, tournament_id
  FROM achievements
  GROUP BY name, tournament_id
  HAVING COUNT(*) > 1
) d ON a.name = d.name AND a.tournament_id = d.tournament_id;

-- For each set of duplicates, we'll keep the oldest one and delete the rest
-- This query will show what will be deleted
SELECT 'Will delete: ' || COUNT(*) || ' duplicate achievements' as message
FROM achievements a
JOIN (
  SELECT 
    name, 
    tournament_id,
    MIN(created_at) as oldest_created_at
  FROM achievements
  GROUP BY name, tournament_id
  HAVING COUNT(*) > 1
) d ON a.name = d.name 
  AND a.tournament_id = d.tournament_id 
  AND a.created_at > d.oldest_created_at;

-- Uncomment and run this to actually delete the duplicates
/*
DELETE FROM achievements a
USING (
  SELECT 
    name, 
    tournament_id,
    MIN(created_at) as oldest_created_at
  FROM achievements
  GROUP BY name, tournament_id
  HAVING COUNT(*) > 1
) d 
WHERE a.name = d.name 
  AND a.tournament_id = d.tournament_id 
  AND a.created_at > d.oldest_created_at;

-- Now let's add a unique constraint to prevent future duplicates
ALTER TABLE achievements 
ADD CONSTRAINT achievements_name_tournament_unique 
UNIQUE (name, tournament_id);
*/
