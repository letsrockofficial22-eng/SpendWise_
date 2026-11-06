'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {browserClient} from '../lib/supabase/client';
import {deleteOfflineState} from '../lib/offline-storage';
import {useStore} from './store';

export function AccountControls(){
  const router=useRouter();
  const {accountId}=useStore();
  const [email,setEmail]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  async function changeEmail(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const {error}=await browserClient().auth.updateUser({email},{emailRedirectTo:`${window.location.origin}/auth/confirm`});
      if(error)throw error;
      setEmail('');
      setMessage('Check your new email address and follow the confirmation link to finish the change.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not request the email change.');
    }finally{
      setBusy(false);
    }
  }

  async function deleteAccount(){
    if(confirmation!=='DELETE'||busy)return;
    setBusy(true);setError('');setMessage('');
    try{
      const {error}=await browserClient().functions.invoke('delete-account',{body:{}});
      if(error)throw error;
      let cleanupError='';
      try{await deleteOfflineState(accountId)}
      catch(cause){cleanupError=cause instanceof Error?cause.message:'Could not erase local account data.'}
      const {error:signOutError}=await browserClient().auth.signOut({scope:'local'});
      if(signOutError)throw signOutError;
      if(cleanupError){
        window.alert(`Your cloud account was deleted, but this device could not erase its local copy: ${cleanupError}`);
        return;
      }
      router.replace('/login?reason=deleted');
      router.refresh();
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not delete the account. Please try again.');
    }finally{
      setBusy(false);
    }
  }

  return <section className="card profile-card account-controls"><h2>Account security</h2><form className="profile-form" onSubmit={changeEmail}><label>Change email address<input type="email" autoComplete="email" required value={email} onChange={event=>setEmail(event.target.value)}/></label><button className="button outline" disabled={busy||!email.trim()}>Request email change</button></form><p className="auth-hint">The new address must be confirmed before the change takes effect.</p><div className="profile-form"><label>Type DELETE to erase this account and its cloud data<input value={confirmation} onChange={event=>setConfirmation(event.target.value)} autoComplete="off"/></label><button type="button" className="button danger" disabled={busy||confirmation!=='DELETE'||!accountId} onClick={()=>void deleteAccount()}>{busy?'Please wait…':'Delete account permanently'}</button></div>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}</section>;
}
