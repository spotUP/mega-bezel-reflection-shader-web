-- Fix bracket_matches round constraint to allow negative values for double elimination
-- Negative rounds will be used for losers bracket in double elimination tournaments

-- Drop the existing check constraint if it exists
ALTER TABLE bracket_matches DROP CONSTRAINT IF EXISTS bracket_matches_round_check;

-- Add a new constraint that allows any integer values (including negative)
ALTER TABLE bracket_matches ADD CONSTRAINT bracket_matches_round_check CHECK (round IS NOT NULL);