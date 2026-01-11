-- Add missing columns to tournaments table
-- This script adds the is_locked and scores_locked columns that are needed for tournament creation

-- Add is_locked column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments'
        AND column_name = 'is_locked'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tournaments
        ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added is_locked column to tournaments table';
    ELSE
        RAISE NOTICE 'is_locked column already exists in tournaments table';
    END IF;
END $$;

-- Add scores_locked column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments'
        AND column_name = 'scores_locked'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tournaments
        ADD COLUMN scores_locked BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added scores_locked column to tournaments table';
    ELSE
        RAISE NOTICE 'scores_locked column already exists in tournaments table';
    END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.tournaments.is_locked IS 'When true, the tournament is locked (read-only/admin-controlled)';
COMMENT ON COLUMN public.tournaments.scores_locked IS 'When true, prevents new score submissions for this tournament';