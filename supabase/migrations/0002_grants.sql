-- Newer Supabase projects don't grant table access to the API roles
-- automatically. RLS still decides which rows each role can see.

-- Server-only tables: only the secret key (service_role) may use them.
grant select, insert, update, delete on public.google_tokens to service_role;
grant select, insert, update, delete on public.video_meta to service_role;

-- Memberships: signed-in users, limited to their own rows by RLS policies.
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.memberships to service_role;
