import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
};

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST')return Response.json({error:'Method not allowed.'},{status:405,headers:corsHeaders});
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return Response.json({error:'Sign in to delete your account.'},{status:401,headers:corsHeaders});

  const url=Deno.env.get('SUPABASE_URL');
  const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anonKey||!serviceRoleKey)return Response.json({error:'Account deletion is not configured on this server.'},{status:503,headers:corsHeaders});

  const token=authorization.slice('Bearer '.length);
  const userClient=createClient(url,anonKey,{global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:{user},error:userError}=await userClient.auth.getUser(token);
  if(userError||!user)return Response.json({error:'Your session could not be verified. Sign in again and retry.'},{status:401,headers:corsHeaders});

  const adminClient=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
  async function receiptPaths(prefix:string,depth=0):Promise<string[]>{
    if(depth>3)throw new Error('Receipt folder nesting is invalid.');
    const paths:string[]=[];
    for(let offset=0;;offset+=1000){
      const {data,error}=await adminClient.storage.from('receipts').list(prefix,{limit:1000,offset});
      if(error)throw error;
      for(const entry of data||[]){
        const path=`${prefix}/${entry.name}`;
        if(entry.id)paths.push(path);
        else paths.push(...await receiptPaths(path,depth+1));
      }
      if(!data||data.length<1000)break;
    }
    return paths;
  }
  try{
    const paths=await receiptPaths(user.id);
    for(let offset=0;offset<paths.length;offset+=1000){
      const {error}=await adminClient.storage.from('receipts').remove(paths.slice(offset,offset+1000));
      if(error)return Response.json({error:'Receipt files could not be erased, so the account was not deleted.'},{status:500,headers:corsHeaders});
    }
  }catch{
    return Response.json({error:'Receipt files could not be checked, so the account was not deleted.'},{status:500,headers:corsHeaders});
  }
  const {error:deleteError}=await adminClient.auth.admin.deleteUser(user.id);
  if(deleteError)return Response.json({error:'The account could not be deleted.'},{status:500,headers:corsHeaders});
  return Response.json({deleted:true},{headers:corsHeaders});
});
