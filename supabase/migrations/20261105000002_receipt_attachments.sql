alter table public.transactions add column receipt_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('receipts','receipts',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

create policy receipts_select on storage.objects for select to authenticated
using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipts_insert on storage.objects for insert to authenticated
with check(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipts_update on storage.objects for update to authenticated
using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy receipts_delete on storage.objects for delete to authenticated
using(bucket_id='receipts' and (storage.foldername(name))[1]=(select auth.uid())::text);
