-- Lock the NEXA public schema away from Supabase Data API roles.
-- NEXA uses the dedicated nexa_runtime PostgreSQL role for server-side access.
-- Role checks keep this migration portable for canonical CI PostgreSQL.

revoke usage on schema public from public;
revoke all privileges on all tables in schema public from public;
revoke all privileges on all sequences in schema public from public;
revoke execute on all functions in schema public from public;

do $$
begin
  execute format('alter default privileges for role %I in schema public revoke execute on functions from public', current_user);

  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke usage on schema public from anon';
    execute 'revoke all privileges on all tables in schema public from anon';
    execute 'revoke all privileges on all sequences in schema public from anon';
    execute 'revoke execute on all functions in schema public from anon';
    execute format('alter default privileges for role %I in schema public revoke all on tables from anon', current_user);
    execute format('alter default privileges for role %I in schema public revoke all on sequences from anon', current_user);
    execute format('alter default privileges for role %I in schema public revoke execute on functions from anon', current_user);
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke usage on schema public from authenticated';
    execute 'revoke all privileges on all tables in schema public from authenticated';
    execute 'revoke all privileges on all sequences in schema public from authenticated';
    execute 'revoke execute on all functions in schema public from authenticated';
    execute format('alter default privileges for role %I in schema public revoke all on tables from authenticated', current_user);
    execute format('alter default privileges for role %I in schema public revoke all on sequences from authenticated', current_user);
    execute format('alter default privileges for role %I in schema public revoke execute on functions from authenticated', current_user);
  end if;

  if exists (select 1 from pg_roles where rolname = 'nexa_runtime') then
    execute 'grant usage on schema public to nexa_runtime';
    execute 'grant select, insert, update, delete on all tables in schema public to nexa_runtime';
    execute 'grant usage, select on all sequences in schema public to nexa_runtime';
    execute 'grant execute on all functions in schema public to nexa_runtime';
    execute format('alter default privileges for role %I in schema public grant select, insert, update, delete on tables to nexa_runtime', current_user);
    execute format('alter default privileges for role %I in schema public grant usage, select on sequences to nexa_runtime', current_user);
    execute format('alter default privileges for role %I in schema public grant execute on functions to nexa_runtime', current_user);
  end if;
end
$$;
