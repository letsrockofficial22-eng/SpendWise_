'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {Capacitor} from '@capacitor/core';
import {Network} from '@capacitor/network';
import {browserClient} from '../lib/supabase/client';
import {canRestoreOfflineSession,withSessionTimeout} from '../lib/auth-routing';
import {getRememberedOfflineAccount,readOfflineState} from '../lib/offline-storage';

export default function StartPage(){
  const router=useRouter();
  useEffect(()=>{
    let active=true;
    async function route(){
      try{
        const {data,error}=await withSessionTimeout(browserClient().auth.getSession());
        if(!active)return;
        if(data.session?.user){
          router.replace('/dashboard');
          return;
        }
        const rememberedId=getRememberedOfflineAccount();
        const connected=Capacitor.isNativePlatform()
          ? (await Network.getStatus()).connected
          : navigator.onLine;
        const cachedState=rememberedId?await readOfflineState(rememberedId):undefined;
        if(canRestoreOfflineSession(Boolean(cachedState),connected,error)){
          if(active)router.replace('/dashboard');
          return;
        }
        if(active)router.replace('/signup');
      }catch(e){
        if(!active)return;
        const rememberedId=getRememberedOfflineAccount();
        const connected=Capacitor.isNativePlatform()
          ? (await Network.getStatus().catch(()=>({connected:true}))).connected
          : navigator.onLine;
        const cachedState=rememberedId?await readOfflineState(rememberedId):undefined;
        if(canRestoreOfflineSession(Boolean(cachedState),connected,e)){
          if(active)router.replace('/dashboard');
          return;
        }
        router.replace(e instanceof Error&&e.message.includes('not configured')?'/login?reason=config':'/signup');
      }
    }
    route();
    return()=>{active=false};
  },[router]);
  return null;
}
