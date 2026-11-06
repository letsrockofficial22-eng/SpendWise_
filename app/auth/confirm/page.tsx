'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Wallet,ArrowRight} from 'lucide-react';
import {browserClient} from '../../../lib/supabase/client';

const emailTypes=['signup','invite','magiclink','recovery','email_change','email'] as const;
type EmailType=(typeof emailTypes)[number];
const isEmailType=(value:string|null):value is EmailType=>!!value&&(emailTypes as readonly string[]).includes(value);

export default function ConfirmEmailPage(){
  const [status,setStatus]=useState<'checking'|'success'|'error'>('checking');
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    async function confirm(){
      const params=new URLSearchParams(window.location.search);
      const errorCode=params.get('error');
      const errorDescription=params.get('error_description');
      if(errorCode){
        if(active){setError(errorDescription||'This confirmation link is invalid or has expired.');setStatus('error')}
        return;
      }
      try{
        const client=browserClient();
        const code=params.get('code');
        const tokenHash=params.get('token_hash');
        const type=params.get('type');
        if(code){
          const {error}=await client.auth.exchangeCodeForSession(code);
          if(error)throw error;
        }else if(tokenHash&&isEmailType(type)){
          const {error}=await client.auth.verifyOtp({token_hash:tokenHash,type});
          if(error)throw error;
        }else{
          const hash=new URLSearchParams(window.location.hash.replace(/^#/,''));
          const accessToken=hash.get('access_token');
          const refreshToken=hash.get('refresh_token');
          if(!accessToken||!refreshToken)throw new Error('This confirmation link is incomplete or has already been used.');
          const {error}=await client.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
          if(error)throw error;
        }
        if(type==='recovery'){
          if(active)window.location.replace('/auth/reset-password');
          return;
        }
        if(active){setStatus('success');window.history.replaceState(null,'',window.location.pathname)}
      }catch(e){
        if(active){setError(e instanceof Error?e.message:'Could not confirm your email. Please sign in and try again.');setStatus('error')}
      }
    }
    confirm();
    return()=>{active=false};
  },[]);
  return <main className="auth-page"><Link href="/" className="brand"><span className="brand-icon"><Wallet size={19}/></span> spendwise<span className="brand-dot">.</span></Link><section className="card auth-card" aria-live="polite"><span className="eyebrow">EMAIL CONFIRMATION</span><h1>{status==='checking'?'Confirming your email':status==='success'?'Email confirmed':'Could not confirm your email'}</h1>{status==='checking'&&<p>Please wait while we verify your email link…</p>}{status==='success'&&<><p>Your email is confirmed. Your SpendWise account is ready to use.</p><Link href="/dashboard" className="button">Go to dashboard <ArrowRight size={16}/></Link></>}{status==='error'&&<><p role="alert" className="error">{error}</p><p>Sign in to continue. If your email is not confirmed yet, create your account again to request a new confirmation email.</p><div className="confirm-actions"><Link href="/login" className="button outline">Sign in</Link><Link href="/signup" className="button">Create account</Link></div></>}</section></main>;
}
