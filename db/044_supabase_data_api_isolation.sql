-- Lock the NEXA public schema away from Supabase Data API roles.
-- NEXA uses the dedicated nexa_runtime PostgreSQL role for server-side access.

revoke usage on schema public from public, anon, authenticated;

revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

grant usage on schema public to nexa_runtime;
grant select, insert, update, delete on all tables in schema public to nexa_runtime;
grant usage, select on all sequences in schema public to nexa_runtime;

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to nexa_runtime;

alter default privileges for role postgres in schema public
  grant usage, select on sequences to nexa_runtime;
