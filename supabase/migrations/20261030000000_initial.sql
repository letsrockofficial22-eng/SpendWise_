-- Apply as a migration owner. Client access remains subject to RLS.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text check (display_name is null or char_length(display_name) <= 100),
 currency text not null default 'BDT' check (currency = 'BDT'),
 daily_budget numeric(12,2) not null default 300 check (daily_budget > 0),
 theme text not null default 'system' check (theme in ('light','dark','system')),
 week_start text not null default 'sunday' check (week_start in ('sunday','monday')),
 payment_method text not null default 'cash' check (payment_method in ('cash','bkash','nagad','bank','other')),
 notifications boolean not null default true,
 timezone text not null default 'Asia/Dhaka' check (timezone in ('Asia/Dhaka','UTC','Asia/Kolkata','Europe/London','America/New_York')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 type text not null check (type in ('income','expense')), amount numeric(12,2) not null check (amount > 0),
 category text not null check (char_length(trim(category)) between 1 and 100), subcategory text check (char_length(subcategory) <= 100),
 description text check (char_length(description) <= 500), payment_method text not null check (payment_method in ('cash','bkash','nagad','bank','other')),
 transaction_date timestamptz not null, notes text check (char_length(notes) <= 2000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.budgets (
 id uuid primary key default gen_random_uuid(), user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 100), amount numeric(12,2) not null check (amount > 0),
 period text not null check (period in ('daily','monthly')), category text check (char_length(category) <= 100),
 month date check (month is null or (period = 'monthly' and extract(day from month) = 1)),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index transactions_user_category_date_idx on public.transactions(user_id, category, transaction_date desc);
create index budgets_user_idx on public.budgets(user_id);
create index budgets_user_category_month_idx on public.budgets(user_id, category, month);
create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger transactions_updated before update on public.transactions for each row execute function public.set_updated_at();
create trigger budgets_updated before update on public.budgets for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
-- No user-supplied metadata is trusted. The owner can later edit their profile under RLS.
create function public.create_profile_for_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.profiles(id) values (new.id); return new; end $$;
revoke all on function public.create_profile_for_user() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile_for_user();
-- Also provision accounts that existed before this migration was applied.
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy profiles_delete on public.profiles for delete to authenticated using ((select auth.uid()) = id);
create policy transactions_select on public.transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy transactions_insert on public.transactions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy transactions_update on public.transactions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_delete on public.transactions for delete to authenticated using ((select auth.uid()) = user_id);
create policy budgets_select on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy budgets_insert on public.budgets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy budgets_update on public.budgets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_delete on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);
