-- Check current RLS status and policies
-- Run this in Supabase SQL editor or psql

-- Check RLS status on critical tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('admin_users', 'user_roles', 'tournament_members', 'games', 'user_role_cache')
ORDER BY tablename;

-- Check existing policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('admin_users', 'user_roles', 'tournament_members', 'games', 'user_role_cache')
ORDER BY tablename, policyname;

-- Enable RLS on tables that don't have it enabled
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_cache ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies (if they exist)
DROP POLICY IF EXISTS "Allow all operations on admin_users" ON admin_users;
DROP POLICY IF EXISTS "Allow all operations on user_roles" ON user_roles;
DROP POLICY IF EXISTS "Allow all operations on tournament_members" ON tournament_members;
DROP POLICY IF EXISTS "Allow all operations on games" ON games;
DROP POLICY IF EXISTS "Allow all operations on user_role_cache" ON user_role_cache;

-- Create proper security policies for admin_users table
-- Only admins can view admin users
DROP POLICY IF EXISTS "Admin users can view admin_users" ON admin_users;
CREATE POLICY "Admin users can view admin_users" ON admin_users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only service role can manage admin_users
DROP POLICY IF EXISTS "Service role can manage admin_users" ON admin_users;
CREATE POLICY "Service role can manage admin_users" ON admin_users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Create proper security policies for user_roles table
-- Users can view their own roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;
CREATE POLICY "Users can view their own roles" ON user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
CREATE POLICY "Admins can view all user roles" ON user_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Only admins can manage user roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;
CREATE POLICY "Admins can manage user roles" ON user_roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
    )
  );

-- Create proper security policies for tournament_members table
-- Users can view tournament members for tournaments they are part of
DROP POLICY IF EXISTS "Users can view tournament members" ON tournament_members;
CREATE POLICY "Users can view tournament members" ON tournament_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tournament_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.tournament_id = tournament_members.tournament_id
    )
  );

-- Tournament admins/owners can manage members
DROP POLICY IF EXISTS "Tournament admins can manage members" ON tournament_members;
CREATE POLICY "Tournament admins can manage members" ON tournament_members
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.tournament_id = tournament_members.tournament_id
      AND tm.role IN ('admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_members tm
      WHERE tm.user_id = auth.uid()
      AND tm.tournament_id = tournament_members.tournament_id
      AND tm.role IN ('admin', 'owner')
    )
  );

-- Create proper security policies for games table
-- Everyone can read games
DROP POLICY IF EXISTS "Anyone can view games" ON games;
CREATE POLICY "Anyone can view games" ON games
  FOR SELECT TO public
  USING (true);

-- Only authenticated users can create games
DROP POLICY IF EXISTS "Authenticated users can create games" ON games;
CREATE POLICY "Authenticated users can create games" ON games
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only game creators or admins can update games
DROP POLICY IF EXISTS "Game creators and admins can update games" ON games;
CREATE POLICY "Game creators and admins can update games" ON games
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Only game creators or admins can delete games
DROP POLICY IF EXISTS "Game creators and admins can delete games" ON games;
CREATE POLICY "Game creators and admins can delete games" ON games
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create proper security policies for user_role_cache table
-- Users can view their own role cache
DROP POLICY IF EXISTS "Users can view their own role cache" ON user_role_cache;
CREATE POLICY "Users can view their own role cache" ON user_role_cache
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Only service role can manage user_role_cache (for cache updates)
DROP POLICY IF EXISTS "Service role can manage user_role_cache" ON user_role_cache;
CREATE POLICY "Service role can manage user_role_cache" ON user_role_cache
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);