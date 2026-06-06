create or replace function public.save_profile_xp_secure(total_xp integer)
returns table (xp integer, level integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid := auth.uid();
  safe_xp integer := greatest(coalesce(total_xp, 0), 0);
begin
  if requester is null then
    raise exception 'Authentication required';
  end if;

  perform public.ensure_profile_for_current_user();

  update public.profiles
  set xp = safe_xp,
      level = public.secure_level_for_xp(safe_xp)
  where id = requester
  returning xp, level into xp, level;

  return query select xp, level;
end;
$$;

grant execute on function public.save_profile_xp_secure(integer) to authenticated;
