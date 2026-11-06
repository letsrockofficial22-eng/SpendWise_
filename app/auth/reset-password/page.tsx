'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ArrowRight,Wallet} from 'lucide-react';
import {browserClient} from '../../../lib/supabase/client';

export default function ResetPasswordPage(){
  const router=useRouter();
  const [password,setPassword]=useState('');
  const [confirmed,setConfirmed]=useState('');
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let active=true;
    async function validateResetLink(){
      try{
        const client=browserClient();
        const params=new URLSearchParams(window.location.search);
        const code=params.get('code');
        const tokenHash=params.get('token_hash');
        const type=params.get('type');
        const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
        if(code){
          const {error}=await client.auth.exchangeCodeForSession(code);
          if(error)throw error;
        }else if(tokenHash&&type==='recovery'){
          const {error}=await client.auth.verifyOtp({token_hash:tokenHash,type:'recovery'});
          if(error)throw error;
        }else if(hash.get('access_token')&&hash.get('refresh_token')){
          const {error}=await client.auth.setSession({
            access_token:hash.get('access_token')!,
            refresh_token:hash.get('refresh_token')!,
          });
          if(error)throw error;
        }
        const {data,error}=await client.auth.getSession();
        if(error)throw error;
        if(!active)return;
        if(!data.session)setError('This password reset link is invalid or has expired. Request a new one and try again.');
        else setReady(true);
      }catch(cause){
        if(active)setError(cause instanceof Error?cause.message:'Could not validate this password reset link.');
      }
    }
    void validateResetLink();
    return()=>{active=false};
  },[]);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    if(password.length<8){setError('Use a password with at least 8 characters.');return}
    if(password!==confirmed){setError('The passwords do not match.');return}
    setBusy(true);setError('');
    try{
      const {error}=await browserClient().auth.updateUser({password});
      if(error)throw error;
      router.replace('/dashboard');
      router.refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not update your password. Request a new reset link and try again.');
    }finally{
      setBusy(false);
    }
  }

  return <main className="auth-page"><Link href="/" className="brand"><span className="brand-icon"><Wallet size={19}/></span> spendwise<span className="brand-dot">.</span></Link><section className="card auth-card"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Choose a new password</h1>{ready?<form className="profile-form" onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event=>setPassword(event.target.value)}/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmed} onChange={event=>setConfirmed(event.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}<button className="button" disabled={busy}>{busy?'Saving…':'Save password'} <ArrowRight size={16}/></button></form>:error?<p role="alert" className="error">{error}</p>:<p role="status">Checking your secure reset link…</p>}<p><Link className="text-link" href="/forgot-password">Request another reset link</Link></p></section></main>;
}
