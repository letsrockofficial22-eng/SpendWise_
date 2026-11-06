'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Capacitor} from '@capacitor/core';
import {Browser} from '@capacitor/browser';
import {Wallet,ArrowRight,Eye,EyeOff} from 'lucide-react';
import {browserClient} from '../lib/supabase/client';

export function AuthForm({mode}:{mode:'login'|'signup'}){
  const router=useRouter();
  const [firstName,setFirstName]=useState('');
  const [lastName,setLastName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [showPassword,setShowPassword]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function submit(e:React.FormEvent){
    e.preventDefault();
    if(busy)return;
    const first=firstName.trim(),last=lastName.trim();
    if(mode==='signup'&&(!first||!last)){setError('Enter your first and last name.');return}
    setBusy(true);setError('');setMessage('');
    try{
      const client=browserClient();
      if(mode==='signup'){
        const emailRedirectTo=Capacitor.isNativePlatform()?'spendwise://auth/confirm':`${window.location.origin}/auth/confirm`;
        const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo,data:{first_name:first,last_name:last,full_name:`${first} ${last}`}}});
        if(error)throw error;
        if(!data.session){setMessage('Check your email for a verification link. If you already have an account, try signing in.');return}
      }else{
        const {error}=await client.auth.signInWithPassword({email,password});
        if(error)throw error;
      }
      const next=new URLSearchParams(window.location.search).get('next');
      router.replace(next?.startsWith('/')&&!next.startsWith('//')&&!next.includes('\\')?next:'/dashboard');
      router.refresh();
    }catch(e){
      setError(e instanceof Error&&e.message.includes('not configured')?e.message:mode==='login'?'Could not sign in. Check your credentials and verify your email.':'Could not create your account. Check your details and try again.');
    }finally{
      setBusy(false);
    }
  }

  async function signInWithGoogle(){
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const redirectTo=Capacitor.isNativePlatform()?'spendwise://auth/callback':`${window.location.origin}/auth/callback`;
      const {data,error}=await browserClient().auth.signInWithOAuth({provider:'google',options:{redirectTo,skipBrowserRedirect:true}});
      if(error)throw error;
      if(!data.url)throw new Error('Google sign-in did not return an authorization URL.');
      if(Capacitor.isNativePlatform())await Browser.open({url:data.url});
      else window.location.assign(data.url);
    }catch(e){
      setError(e instanceof Error&&e.message.includes('not configured')?e.message:'Could not start Google sign-in. Please try again.');
      setBusy(false);
    }
  }

  return <main className="auth-page"><Link href="/" className="brand"><span className="brand-icon"><Wallet size={19}/></span> spendwise<span className="brand-dot">.</span></Link><section className="card auth-card"><span className="eyebrow">YOUR MONEY, MADE SIMPLE</span><h1>{mode==='login'?'Welcome back':'Create your account'}</h1><p>{mode==='login'?'Sign in to see your spending.':'Start building better money habits today.'}</p><button type="button" className="button outline" disabled={busy} onClick={()=>void signInWithGoogle()}>Continue with Google</button><form className="profile-form" onSubmit={submit}>{mode==='signup'&&<><label>First name<input type="text" autoComplete="given-name" required maxLength={50} value={firstName} onChange={e=>setFirstName(e.target.value)}/></label><label>Last name<input type="text" autoComplete="family-name" required maxLength={50} value={lastName} onChange={e=>setLastName(e.target.value)}/></label></>}<label>Email<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Password<div className="password-field"><input type={showPassword?'text':'password'} autoComplete={mode==='login'?'current-password':'new-password'} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" className="password-toggle" onClick={()=>setShowPassword(value=>!value)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}<span>{showPassword?'Hide':'Show'}</span></button></div></label>{mode==='login'&&<Link className="text-link" href="/forgot-password">Forgot password?</Link>}{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status">{message}</p>}<button disabled={busy} className="button">{busy?'Please wait…':mode==='login'?'Sign in':'Create account'} <ArrowRight size={16}/></button></form><p>{mode==='login'?<>New to SpendWise? <Link className="text-link" href="/signup">Create an account</Link></>:<>Already have an account? <Link className="text-link" href="/login">Sign in</Link></>}</p><p className="auth-hint">Protected pages require an account. If your session expired, please sign in again.</p><p className="auth-hint"><Link className="text-link" href="/contact">Need help? Contact us</Link></p></section></main>;
}
