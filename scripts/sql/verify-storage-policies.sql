-- Audit storage schema RLS and policies

-- 1) RLS status for storage tables of interest
select n.nspname as schema,
       c.relname as table,
       c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'storage'
  and c.relkind = 'r'
  and c.relname in ('objects', 'buckets')
order by 1,2;

-- 2) Policies defined on storage.objects and storage.buckets
select p.schemaname,
       p.tablename,
       p.policyname,
       p.cmd as for_command,
       p.permissive
from pg_policies p
where p.schemaname = 'storage'
  and p.tablename in ('objects','buckets')
order by 1,2,3;

-- 3) Buckets visibility and public flag (if using Supabase storage meta)
select id, name, public
from storage.buckets
order by name;
