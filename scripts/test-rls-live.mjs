import {createClient} from '@supabase/supabase-js';
import process from 'node:process';

const required=[
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'RLS_USER_A_EMAIL',
  'RLS_USER_A_PASSWORD',
  'RLS_USER_B_EMAIL',
  'RLS_USER_B_PASSWORD',
];
const missing=required.filter(name=>!process.env[name]);
if(missing.length)throw new Error(`Missing live RLS test environment variables: ${missing.join(', ')}`);

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const createSessionClient=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const owner=createSessionClient();
const other=createSessionClient();
const anonymous=createSessionClient();

const {data:ownerData,error:ownerError}=await owner.auth.signInWithPassword({
  email:process.env.RLS_USER_A_EMAIL,
  password:process.env.RLS_USER_A_PASSWORD,
});
if(ownerError||!ownerData.user)throw new Error(`Could not sign in RLS test account A: ${ownerError?.message||'missing user'}`);
const {data:otherData,error:otherError}=await other.auth.signInWithPassword({
  email:process.env.RLS_USER_B_EMAIL,
  password:process.env.RLS_USER_B_PASSWORD,
});
if(otherError||!otherData.user)throw new Error(`Could not sign in RLS test account B: ${otherError?.message||'missing user'}`);

const ownedRows=[];
const today=new Date().toISOString().slice(0,10);
const cases=[
  {table:'transactions',payload:{type:'expense',amount:1,category:'RLS verification',payment_method:'cash',transaction_date:new Date().toISOString()},update:{category:'RLS modified'}},
  {table:'budgets',payload:{name:'RLS verification',amount:1,period:'monthly'},update:{name:'RLS modified'}},
  {table:'loans',payload:{direction:'repay',person:'RLS verification',principal:1,remaining:1,due_date:today},update:{person:'RLS modified'}},
  {table:'recurring_bills',payload:{name:'RLS verification',amount:1,category:'Other',frequency:'monthly',next_due:today,reminder:false},update:{name:'RLS modified'}},
  {table:'shared_expenses',payload:{title:'RLS verification',total:1,paid_by:'RLS owner',shares:[]},update:{title:'RLS modified'}},
];

try{
  for(const test of cases){
    const {data:created,error:createError}=await owner.from(test.table).insert(test.payload).select('id').single();
    if(createError||!created)throw new Error(`${test.table}: account A could not create a test row (${createError?.message||'no row returned'}).`);
    const id=created.id;
    ownedRows.push({table:test.table,id});

    const {data:visible,error:readError}=await other.from(test.table).select('id').eq('id',id);
    if(readError)throw new Error(`${test.table}: account B read check failed (${readError.message}).`);
    if(visible.length)throw new Error(`${test.table}: account B can read account A's row.`);

    const {data:updated,error:updateError}=await other.from(test.table).update(test.update).eq('id',id).select('id');
    if(updateError)throw new Error(`${test.table}: account B update check failed (${updateError.message}).`);
    if(updated.length)throw new Error(`${test.table}: account B can update account A's row.`);

    const {data:deleted,error:deleteError}=await other.from(test.table).delete().eq('id',id).select('id');
    if(deleteError)throw new Error(`${test.table}: account B delete check failed (${deleteError.message}).`);
    if(deleted.length)throw new Error(`${test.table}: account B can delete account A's row.`);

    const {error:insertError}=await other.from(test.table).insert({...test.payload,user_id:ownerData.user.id}).select('id').single();
    if(!insertError)throw new Error(`${test.table}: account B can insert a row owned by account A.`);
    console.log(`PASS ${test.table}: cross-account select/insert/update/delete blocked`);
  }

  const {data:profileRead,error:profileError}=await other.from('profiles').select('id').eq('id',ownerData.user.id);
  if(profileError)throw new Error(`profiles: account B read check failed (${profileError.message}).`);
  if(profileRead.length)throw new Error('profiles: account B can read account A profile.');

  const {data:anonymousRead,error:anonymousError}=await anonymous.from('transactions').select('id').eq('id',ownedRows[0].id);
  if(anonymousError)throw new Error(`Anonymous read check failed (${anonymousError.message}).`);
  if(anonymousRead.length)throw new Error('Anonymous users can read an authenticated transaction.');
  console.log('PASS profiles and anonymous access isolation');
}finally{
  for(const row of ownedRows){
    const {error}=await owner.from(row.table).delete().eq('id',row.id);
    if(error)console.error(`Cleanup failed for ${row.table} row ${row.id}: ${error.message}`);
  }
  await Promise.all([owner.auth.signOut(),other.auth.signOut()]);
}
