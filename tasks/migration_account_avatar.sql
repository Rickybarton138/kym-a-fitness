-- Account screen: profile picture. (2026-10-15)
--
-- Ricky's ask: one place for a client's PAR-Q/health info, their login details
-- and "the option to add a profile pic". The first two already existed on the
-- "My details" screen; this adds the picture and makes the screen an account
-- screen rather than a health one.
--
-- WHY A PATH AND NOT A URL. avatar_path holds the Storage object key, never a
-- URL. The column is client-writable (it has to be -- it is their own picture),
-- and a client-writable URL column is an open redirect into the coach's app:
-- set it to an external address and the coach's browser fetches it every time
-- the client list renders, leaking the coach's IP and giving the client a
-- read receipt on when their coach looked at them. A path can only ever
-- resolve inside our own bucket.
--
-- One Supabase project serves every brand, so this is live on all of them the
-- moment it is applied. That is safe: the column is nullable and the UI that
-- writes it ships separately.

alter table public.profiles add column if not exists avatar_path text;

-- Add avatar_path to the column-level UPDATE allow-list. An INCREMENTAL grant,
-- deliberately: `revoke update` + re-grant would be the whole list restated,
-- and tasks/migration_profile_column_grants.sql is already out of date (it
-- predates glp1 and glp1_med, both of which are granted in production).
-- Restating a stale list would silently REMOVE those two and break the GLP-1
-- field on Paul's and Elev8's apps. See the header of that file for why the
-- allow-list exists at all: RLS cannot restrict columns, and table-wide UPDATE
-- let a client rewrite their own trainer_id.
grant update (avatar_path) on public.profiles to authenticated;

-- Private, like body-photos: a face is personal data, and a public bucket means
-- a guessable URL to every client's photograph in every gym on the platform.
-- Read through short-lived signed URLs instead.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- Folder-per-client, exactly the body-photos pattern. The first path segment
-- must be the caller's own uid, so a client can write ONLY their own folder.
-- Without this any signed-in client could overwrite anybody's face -- the
-- storage version of "RLS restricts rows, not columns".
drop policy if exists "avatars client manage own" on storage.objects;
create policy "avatars client manage own" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- The coach sees their own clients' pictures and nobody else's. is_my_client()
-- is the same helper every other coach-read policy uses.
drop policy if exists "avatars coach read clients" on storage.objects;
create policy "avatars coach read clients" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and is_my_client(((storage.foldername(name))[1])::uuid));
