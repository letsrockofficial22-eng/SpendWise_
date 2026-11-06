'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {browserClient} from '../../../lib/supabase/client';

export default function AuthCallbackPage(){
  const router=useRouter();
  useEffect(()=>{
    let active=true;
    async function exchangeCode(){
      const params=new URLSearchParams(window.location.search);
      const code=params.get('code');
      const tokenHash=params.get('token_hash');
      const type=params.get('type');
      const next=params.get('next');
      const safeNext=next?.startsWith('/')&&!next.startsWith('//')&&!next.includes('\\')?next:'/dashboard';
      const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
      try{
        const client=browserClient();
        if(code){
          const {error}=await client.auth.exchangeCodeForSession(code);
          if(error)throw error;
        }else if(tokenHash&&type==='recovery'){
          const {error}=await client.auth.verifyOtp({token_hash:tokenHash,type:'recovery'});
          if(error)throw error;
        }else if(hash.get('access_token')&&hash.get('refresh_token')){
          const {error}=await client.auth.setSession({access_token:hash.get('access_token')!,refresh_token:hash.get('refresh_token')!});
          if(error)throw error;
        }else{
          router.replace('/login?reason=verification');
          return;
        }
        if(active){router.replace(safeNext);router.refresh()}
      }catch(error){
        if(!active)return;
        const reason=error instanceof Error&&error.message.includes('not configured')?'config':'verification';
        router.replace(`/login?reason=${reason}`);
      }
    }
    void exchangeCode();
    return()=>{active=false};
  },[router]);
  return <main className="auth-page"><section className="card auth-card splash-card"><span className="splash-spinner" aria-hidden="true"/><h1>Signing you in</h1><p role="status">Verifying your session…</p></section></main>;
}
