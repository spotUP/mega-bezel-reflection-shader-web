-- Verify tournament trigger on player_achievements
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def
FROM pg_trigger 
WHERE tgrelid = 'player_achievements'::regclass 
  AND NOT tgisinternal
  AND tgname = 'trg_set_player_achievements_tournament_id';

-- Verify scores -> achievement trigger is INSERT-only
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS def
FROM pg_trigger
WHERE tgrelid = 'scores'::regclass
  AND tgname = 'achievement_check_trigger';

-- Remaining NULL tournament_id in player_achievements
SELECT COUNT(*) AS remaining_nulls
FROM player_achievements
WHERE tournament_id IS NULL;

-- Unique constraint on (player_name, achievement_id)
SELECT conname
FROM pg_constraint
WHERE conname = 'player_achievements_player_name_achievement_id_key';
