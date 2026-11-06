-- Capture the name supplied at sign-up (auth metadata) for the profile display name.
create or replace function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  full_name text;
begin
  full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')), '')
  );
  insert into public.profiles(id, display_name) values (new.id, left(full_name, 100));
  return new;
end $$;
revoke all on function public.create_profile_for_user() from public;

-- Backfill existing profiles that were created before names were captured.
update public.profiles p
set display_name = left(coalesce(
  nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
  nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), '')
), 100)
from auth.users u
where u.id = p.id
  and p.display_name is null
  and coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'first_name', u.raw_user_meta_data->>'last_name')), '')
  ) is not null;
