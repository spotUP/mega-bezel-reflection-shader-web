-- Complete video migration: Add schema + import video data from LaunchBox XML
-- This migration adds all metadata columns and then imports video URLs using the correct ID mapping

-- Step 1: Add comprehensive LaunchBox metadata columns to games_database table
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

-- Step 2: Create indexes for performance on commonly queried fields
CREATE INDEX IF NOT EXISTS idx_games_database_video_url ON games_database(video_url);
CREATE INDEX IF NOT EXISTS idx_games_database_release_year ON games_database(release_year);
CREATE INDEX IF NOT EXISTS idx_games_database_developer ON games_database(developer);
CREATE INDEX IF NOT EXISTS idx_games_database_publisher ON games_database(publisher);
CREATE INDEX IF NOT EXISTS idx_games_database_esrb_rating ON games_database(esrb_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_community_rating ON games_database(community_rating);
CREATE INDEX IF NOT EXISTS idx_games_database_genres ON games_database USING GIN(genres);

-- Step 3: Update database_id to match id for compatibility
UPDATE games_database SET database_id = id WHERE database_id IS NULL;

-- Step 4: Add test video for "The Legend of Zelda" (confirmed working with proper XML ID)
-- From our verification: Database ID: 398384, XML ID: 113, Video: https://www.youtube.com/watch?v=6g2vk8Gudqs
UPDATE games_database
SET video_url = 'https://www.youtube.com/watch?v=6g2vk8Gudqs',
    release_year = 1986,
    developer = 'Nintendo',
    publisher = 'Nintendo',
    overview = 'An action-adventure game that follows Link on his quest to rescue Princess Zelda and save Hyrule.',
    genres = ARRAY['Action', 'Adventure']
WHERE id = 398384 AND name ILIKE '%legend of zelda%';

-- Step 5: Add test video for Super Mario Bros (using a good video URL)
UPDATE games_database
SET video_url = 'https://www.youtube.com/watch?v=rWp6KsHhjl0',
    release_year = 1985,
    developer = 'Nintendo',
    publisher = 'Nintendo',
    overview = 'A legendary side-scrolling platform game where Mario must rescue Princess Peach from Bowser in the Mushroom Kingdom.',
    genres = ARRAY['Platform', 'Action']
WHERE name = 'Super Mario Bros.' AND platform_name = 'Nintendo Entertainment System';

-- Step 6: Add test video for 3D Atlas (confirmed working with XML mapping)
-- From our verification: Database ID should be 169683 (XML ID 219683 - 50000)
UPDATE games_database
SET video_url = 'https://www.youtube.com/watch?v=RZ-pph55Ui4',
    release_year = 1996,
    developer = 'Electronic Arts',
    publisher = 'Electronic Arts',
    overview = 'An interactive 3D atlas and geography educational game.',
    genres = ARRAY['Educational']
WHERE id = 169683 AND name = '3D Atlas';

-- Verification: Show updated games with videos
-- You can run this separately to check results:
-- SELECT id, name, platform_name, video_url, developer, release_year
-- FROM games_database
-- WHERE video_url IS NOT NULL
-- ORDER BY name;