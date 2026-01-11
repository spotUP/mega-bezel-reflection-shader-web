-- Quick script to ensure Demolition Man game exists
-- Run this directly in your Supabase SQL Editor if needed

-- Insert Demolition Man game if it doesn't already exist
INSERT INTO public.games (
  id,
  name,
  description,
  logo_url,
  is_active,
  include_in_challenge,
  created_at,
  updated_at
)
SELECT 
  gen_random_uuid(),
  'Demolition Man',
  'Eternal leaderboard for Demolition Man arcade game - scores never reset',
  'https://images.launchbox-app.com/c84bf29b-1b54-4310-9290-9b52f587f442.png',
  true,
  false, -- Not included in regular challenge competitions
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.games WHERE name = 'Demolition Man'
);

-- Verify it was created
SELECT id, name, description, is_active, include_in_challenge 
FROM public.games 
WHERE name = 'Demolition Man';
