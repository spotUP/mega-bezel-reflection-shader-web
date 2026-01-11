-- Fix games table policies - remove references to non-existent created_by column
-- The games table uses admin role-based access control, not ownership-based

-- Drop the problematic policies that reference created_by
DROP POLICY IF EXISTS "Game creators and admins can update games" ON games;
DROP POLICY IF EXISTS "Game creators and admins can delete games" ON games;

-- Create corrected policies using admin role checks (consistent with original design)
-- Use role::text = 'admin' to avoid enum casting issues
CREATE POLICY "Admins can update games" ON games
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text = 'admin'
    )
  );

CREATE POLICY "Admins can delete games" ON games
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role::text = 'admin'
    )
  );

-- Keep the existing read and insert policies as they were correct
-- "Anyone can view games" - allows public read access
-- "Authenticated users can create games" - allows any authenticated user to create games