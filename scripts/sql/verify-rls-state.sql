-- Lists tables that have at least one policy but RLS is currently DISABLED
-- Use this to see what the linter SUPA_policy_exists_rls_disabled is flagging.
select distinct p.schemaname,
       p.tablename,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies pp where pp.schemaname=p.schemaname and pp.tablename=p.tablename) as policy_count
from pg_policies p
join pg_class c on c.relname = p.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
where c.relkind = 'r'
  and c.relrowsecurity = false
order by 1, 2;

-- Overview: all tables that have policies, with RLS on/off and counts
select p.schemaname,
       p.tablename,
       c.relrowsecurity as rls_enabled,
       count(*) as policy_count
from pg_policies p
join pg_class c on c.relname = p.tablename
join pg_namespace n on n.oid = c.relnamespace and n.nspname = p.schemaname
where c.relkind = 'r'
GROUP BY 1,2,3
order by 1,2;

-- Optional: show policies per table (name and command)
select p.schemaname,
       p.tablename,
       p.policyname,
       p.cmd as for_command,
       p.permissive
from pg_policies p
order by 1,2,3;
