create policy "Session creators can end sessions"
  on public.sessions
  for delete
  to authenticated
  using (auth.uid() = created_by);
