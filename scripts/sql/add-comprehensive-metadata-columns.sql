-- Add comprehensive LaunchBox metadata columns to games_database table
-- This enables rich game details including videos, descriptions, ratings, etc.

ALTER TABLE games_database
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS release_year INTEGER,
ADD COLUMN IF NOT EXISTS overview TEXT,
ADD COLUMN IF NOT EXISTS max_players INTEGER,
ADD COLUMN IF NOT EXISTS cooperative BOOLEAN,
ADD COLUMN IF NOT EXISTS community_rating NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS community_rating_count INTEGER,
ADD COLUMN IF NOT EXISTS esrb_rating TEXT,
ADD COLUMN IF NOT EXISTS genres TEXT[], -- Array of genre strings
ADD COLUMN IF NOT EXISTS developer TEXT,
ADD COLUMN IF NOT EXISTS publisher TEXT,
ADD COLUMN IF NOT EXISTS screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS cover_url TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS series TEXT,
ADD COLUMN IF NOT EXISTS region TEXT,
ADD COLUMN IF NOT EXISTS alternative_names TEXT[], -- Array of alternative names
ADD COLUMN IF NOT EXISTS play_modes TEXT[], -- Array of play modes
ADD COLUMN IF NOT EXISTS themes TEXT[], -- Array of themes
ADD COLUMN IF NOT EXISTS wikipedia_url TEXT,
ADD COLUMN IF NOT EXISTS video_urls TEXT[], -- Array of video URLs (for multiple videos)
ADD COLUMN IF NOT EXISTS release_type TEXT,
ADD COLUMN IF NOT EXISTS release_date TEXT,
ADD COLUMN IF NOT EXISTS database_id INTEGER; -- For compatibility with existing interface

-- Create indexes for performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_games_database_video_url ON games_database(video_url);
CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year);
CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer);
CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher);
CREATE INDEX IF NOT EXISTS idx_games_database_esrb_rating ON games_database(esrb_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_community_rating ON games_database(community_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres);

-- Update database_id to match id for compatibility
UPDATE games_database SET database_id = id WHERE database_id IS NULL;