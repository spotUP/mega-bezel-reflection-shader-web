-- RLS verification script for public.tournament_invitations
-- Usage: Replace the placeholders below, then run with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/sql/verify-invitations-rls.sql
-- Placeholders to set before running:
--   :invited_email         -> email address that has an active, unexpired invite row
--   :other_email           -> some other authenticated user's email (not invited)
--   :admin_user_id         -> UUID of a user who is owner/admin of the same tournament

\echo '--- RLS verification: tournament_invitations ---'

-- 1) As anonymous (no claims) -> expect denied / 0 rows
select set_config('request.jwt.claims', '{"role":"anon"}', true);
\echo 'As anon:'
select count(*) as visible_invites_as_anon from public.tournament_invitations;

-- 2) As invited user (only their active, unexpired invites visible)
select set_config('request.jwt.claims', jsonb_build_object(
  'role','authenticated',
  'email', :'invited_email'::text
)::text, true);
\echo 'As invited user (should see only own active, unexpired invites):'
select id, email, tournament_id, expires_at, used_at
from public.tournament_invitations
where lower(email) = lower(:'invited_email');

-- 3) As other authenticated user (not invited) -> expect 0 rows
select set_config('request.jwt.claims', jsonb_build_object(
  'role','authenticated',
  'email', :'other_email'::text
)::text, true);
\echo 'As other authenticated user (should see 0 rows):'
select count(*) as visible_invites_other_user from public.tournament_invitations;

-- 4) As tournament admin/owner (has membership; set sub to admin user id)
select set_config('request.jwt.claims', jsonb_build_object(
  'role','authenticated',
  'sub', :'admin_user_id'::text,
  'email','admin@example.com'
)::text, true);
\echo 'As tournament admin (should be able to see/manage invites for their tournaments):'
select count(*) as visible_invites_as_admin from public.tournament_invitations;

\echo '--- Done ---'
