-- Add tournament-specific rules storage
-- Each tournament can have its own customized rules based on the global rules template

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tournaments'
        AND column_name = 'rules_data'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.tournaments
        ADD COLUMN rules_data JSONB DEFAULT NULL;
        RAISE NOTICE 'Added rules_data column to tournaments table';
    ELSE
        RAISE NOTICE 'rules_data column already exists in tournaments table';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.tournaments.rules_data IS 'Custom rules configuration for this tournament, stored as JSON';