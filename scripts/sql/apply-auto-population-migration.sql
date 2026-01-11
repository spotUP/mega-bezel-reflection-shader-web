-- Auto-population system for new tournaments
-- This ensures every new tournament gets a copy of the template achievements

-- Function to populate default (template) achievements for a tournament
CREATE OR REPLACE FUNCTION populate_default_achievements(p_tournament_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert copies of template achievements (where tournament_id IS NULL) into this tournament
  INSERT INTO achievements (name, description, type, badge_icon, badge_color, criteria, points, is_active, tournament_id)
  SELECT a.name, a.description, a.type, a.badge_icon, a.badge_color, a.criteria, a.points, a.is_active, p_tournament_id
  FROM achievements a
  WHERE a.tournament_id IS NULL
  ON CONFLICT (tournament_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-populate achievements when a new tournament is created
CREATE OR REPLACE FUNCTION trigger_on_tournament_created()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM populate_default_achievements(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_tournament_created_populate_achievements ON tournaments;

-- Create the trigger
CREATE TRIGGER on_tournament_created_populate_achievements
AFTER INSERT ON tournaments
FOR EACH ROW
EXECUTE FUNCTION trigger_on_tournament_created();