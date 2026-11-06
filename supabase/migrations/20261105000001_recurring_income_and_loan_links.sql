alter table public.recurring_bills
 add column transaction_type text not null default 'expense'
 check (transaction_type in ('income','expense'));

alter table public.transactions
 add column loan_id uuid references public.loans(id) on delete set null;
create index transactions_user_loan_idx on public.transactions(user_id,loan_id) where loan_id is not null;

create function public.check_transaction_loan_owner() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.loan_id is not null and not exists(
    select 1 from public.loans l where l.id=new.loan_id and l.user_id=new.user_id
  ) then
    raise exception 'A transaction can only be linked to one of the same account''s loans.';
  end if;
  return new;
end
$$;
revoke all on function public.check_transaction_loan_owner() from public;
create trigger transactions_loan_owner_check
before insert or update on public.transactions
for each row execute function public.check_transaction_loan_owner();
