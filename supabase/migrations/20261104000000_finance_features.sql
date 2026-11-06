create table public.loans (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 direction text not null check (direction in ('repay','lent')),
 person text not null check (char_length(trim(person)) between 1 and 100),
 principal numeric(12,2) not null check (principal > 0),
 remaining numeric(12,2) not null check (remaining >= 0 and remaining <= principal),
 due_date date not null,
 notes text check (char_length(notes) <= 2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.recurring_bills (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 100),
 amount numeric(12,2) not null check (amount > 0),
 category text not null check (char_length(trim(category)) between 1 and 100),
 frequency text not null check (frequency in ('weekly','monthly','yearly')),
 next_due date not null,
 reminder boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.shared_expenses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 title text not null check (char_length(trim(title)) between 1 and 100),
 total numeric(12,2) not null check (total > 0),
 paid_by text not null check (char_length(trim(paid_by)) between 1 and 100),
 shares jsonb not null check (jsonb_typeof(shares) = 'array'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create index loans_user_due_idx on public.loans(user_id,due_date);
create index recurring_bills_user_due_idx on public.recurring_bills(user_id,next_due);
create index shared_expenses_user_created_idx on public.shared_expenses(user_id,created_at desc);
create trigger loans_updated before update on public.loans for each row execute function public.set_updated_at();
create trigger recurring_bills_updated before update on public.recurring_bills for each row execute function public.set_updated_at();
create trigger shared_expenses_updated before update on public.shared_expenses for each row execute function public.set_updated_at();

alter table public.loans enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.shared_expenses enable row level security;
create policy loans_select on public.loans for select to authenticated using ((select auth.uid()) = user_id);
create policy loans_insert on public.loans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy loans_update on public.loans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy loans_delete on public.loans for delete to authenticated using ((select auth.uid()) = user_id);
create policy recurring_bills_select on public.recurring_bills for select to authenticated using ((select auth.uid()) = user_id);
create policy recurring_bills_insert on public.recurring_bills for insert to authenticated with check ((select auth.uid()) = user_id);
create policy recurring_bills_update on public.recurring_bills for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy recurring_bills_delete on public.recurring_bills for delete to authenticated using ((select auth.uid()) = user_id);
create policy shared_expenses_select on public.shared_expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy shared_expenses_insert on public.shared_expenses for insert to authenticated with check ((select auth.uid()) = user_id);
create policy shared_expenses_update on public.shared_expenses for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy shared_expenses_delete on public.shared_expenses for delete to authenticated using ((select auth.uid()) = user_id);
