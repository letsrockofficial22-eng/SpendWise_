'use client';

import {useState} from 'react';
import Link from 'next/link';
import {ArrowRight,Wallet} from 'lucide-react';
import {Capacitor} from '@capacitor/core';
import {browserClient} from '../../lib/supabase/client';

export default function ForgotPasswordPage(){
  const [email,setEmail]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const redirectTo=Capacitor.isNativePlatform()
        ?'spendwise://auth/callback?next=%2Fauth%2Freset-password'
        :`${window.location.origin}/auth/callback?next=%2Fauth%2Freset-password`;
      const {error}=await browserClient().auth.resetPasswordForEmail(email,{redirectTo});
      if(error)throw error;
      setMessage('If an account exists for that email, a password reset link is on its way.');
    }catch(cause){
      setError(cause instanceof Error&&cause.message.includes('not configured')
        ?cause.message:'Could not request a password reset. Please try again.');
    }finally{
      setBusy(false);
    }
  }

  return <main className="auth-page"><Link href="/" className="brand"><span className="brand-icon"><Wallet size={19}/></span> spendwise<span className="brand-dot">.</span></Link><section className="card auth-card"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Reset your password</h1><p>We’ll email you a secure link to choose a new password.</p><form className="profile-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label>{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}<button className="button" disabled={busy}>{busy?'Please wait…':'Send reset link'} <ArrowRight size={16}/></button></form><p><Link className="text-link" href="/login">Back to sign in</Link></p></section></main>;
}
