create table public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('budget_alert','bill_due','sync_error')),
 dedupe_key text not null,
 title text not null check (char_length(title) between 1 and 120),
 body text not null check (char_length(body) between 1 and 500),
 metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
 read_at timestamptz,
 created_at timestamptz not null default now(),
 unique (user_id,dedupe_key)
);
create index notifications_user_created_idx on public.notifications(user_id,created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using ((select auth.uid()) = user_id);
create policy notifications_update on public.notifications for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy notifications_delete on public.notifications for delete to authenticated using ((select auth.uid()) = user_id);

create function public.notify_budget_threshold() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_timezone text;
  account_daily_budget numeric;
  local_day date;
  local_month date;
  spent numeric;
  monthly_budget record;
begin
  if new.type <> 'expense' then return new; end if;

  select coalesce(p.timezone,'Asia/Dhaka'),p.daily_budget
  into account_timezone,account_daily_budget
  from public.profiles p where p.id=new.user_id;
  if account_timezone is null then account_timezone := 'Asia/Dhaka'; end if;
  local_day := (new.transaction_date at time zone account_timezone)::date;
  local_month := date_trunc('month',local_day)::date;

  select coalesce(sum(t.amount),0) into spent
  from public.transactions t
  where t.user_id=new.user_id and t.type='expense'
    and (t.transaction_date at time zone account_timezone)::date=local_day;
  if account_daily_budget is not null and spent >= account_daily_budget then
    insert into public.notifications(user_id,kind,dedupe_key,title,body,metadata)
    values(new.user_id,'budget_alert','daily:'||local_day::text,'Daily budget reached',
      'Today’s expenses have reached or exceeded your daily budget.',
      jsonb_build_object('period','daily','date',local_day))
    on conflict(user_id,dedupe_key) do nothing;
  end if;

  for monthly_budget in
    select b.id,b.name,b.amount,b.category
    from public.budgets b
    where b.user_id=new.user_id and b.period='monthly' and b.category is not null
      and (b.month is null or b.month=local_month)
  loop
    select coalesce(sum(t.amount),0) into spent
    from public.transactions t
    where t.user_id=new.user_id and t.type='expense'
      and t.category=monthly_budget.category
      and date_trunc('month',(t.transaction_date at time zone account_timezone)::date)::date=local_month;
    if spent >= monthly_budget.amount then
      insert into public.notifications(user_id,kind,dedupe_key,title,body,metadata)
      values(new.user_id,'budget_alert',
        'monthly:'||monthly_budget.id::text||':'||local_month::text,
        'Budget reached: '||monthly_budget.name,
        'Spending in '||monthly_budget.category||' has reached or exceeded its monthly budget.',
        jsonb_build_object('period','monthly','budget_id',monthly_budget.id,'month',local_month))
      on conflict(user_id,dedupe_key) do nothing;
    end if;
  end loop;
  return new;
end
$$;
revoke all on function public.notify_budget_threshold() from public;
create trigger transactions_budget_notification
after insert or update on public.transactions
for each row execute function public.notify_budget_threshold();

do $$
declare
  table_name text;
begin
  if not exists(select 1 from pg_publication where pubname='supabase_realtime') then return; end if;
  foreach table_name in array array['profiles','transactions','budgets','loans','recurring_bills','shared_expenses','notifications'] loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end
$$;
