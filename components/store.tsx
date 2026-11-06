'use client';

import React,{createContext,useCallback,useContext,useEffect,useRef,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {Network} from '@capacitor/network';
import {App} from '@capacitor/app';
import {Budget,Loan,RecurringBill,SharedExpense,Transaction,UserPreferences} from '../types';
import {defaultPreferences} from '../lib/mock-data';
import * as api from '../lib/data';
import {browserClient} from '../lib/supabase/client';
import {setTimeZone} from '../lib/date-utils';
import {applyPendingChanges,OfflineState,PendingChange,queuePendingChange,readOfflineState,writeOfflineState} from '../lib/offline-storage';
import {clearRememberedOfflineAccount,getRememberedOfflineAccount,rememberOfflineAccount} from '../lib/offline-storage';
import {canRestoreOfflineSession,isPrivateRoute,privateRouteLoginHref,withSessionTimeout} from '../lib/auth-routing';
import type {BackupData} from '../lib/backup';
import {cancelReminder,scheduleReminder} from '../lib/reminders';
import {localReminderTime} from '../lib/finance-utils';

type Store={
  transactions:Transaction[];
  budgets:Budget[];
  loans:Loan[];
  bills:RecurringBill[];
  sharedExpenses:SharedExpense[];
  preferences:UserPreferences;
  setPreferences:React.Dispatch<React.SetStateAction<UserPreferences>>;
  ready:boolean;
  loadError:string;
  reload:()=>void;
  refresh:()=>Promise<boolean>;
  email:string;
  saveTransaction:(t:Transaction,edit:boolean)=>Promise<void>;
  removeTransaction:(id:string)=>Promise<void>;
  saveBudget:(b:Budget,edit:boolean)=>Promise<void>;
  removeBudget:(id:string)=>Promise<void>;
  saveLoan:(loan:Loan)=>Promise<void>;
  payLoan:(loan:Loan,transaction:Transaction)=>Promise<void>;
  removeLoan:(id:string)=>Promise<void>;
  saveBill:(bill:RecurringBill)=>Promise<void>;
  removeBill:(id:string)=>Promise<void>;
  payBill:(bill:RecurringBill,transaction:Transaction)=>Promise<void>;
  saveSharedExpense:(expense:SharedExpense)=>Promise<void>;
  removeSharedExpense:(id:string)=>Promise<void>;
  restoreBackup:(data:BackupData)=>Promise<number>;
  accountId:string;
  signOut:()=>Promise<void>;
  toast:(s:string)=>void;
};

const Context=createContext<Store|null>(null);
type PendingChangeInput=
  |{id:string;type:'transaction.save';value:Transaction}
  |{id:string;type:'transaction.delete';value:string}
  |{id:string;type:'budget.save';value:Budget}
  |{id:string;type:'budget.delete';value:string}
  |{id:string;type:'loan.save';value:Loan}
  |{id:string;type:'loan.delete';value:string}
  |{id:string;type:'bill.save';value:RecurringBill}
  |{id:string;type:'bill.delete';value:string}
  |{id:string;type:'sharedExpense.save';value:SharedExpense}
  |{id:string;type:'sharedExpense.delete';value:string}
  |{id:string;type:'profile.save';value:UserPreferences};

function isConnectionError(error:unknown){
  if(error instanceof TypeError)return true;
  const message=error instanceof Error?error.message.toLowerCase():'';
  return message.includes('failed to fetch')||message.includes('network request failed')||message.includes('fetch failed')||message.includes('networkerror');
}

function initialPreferences(displayName:string|undefined):UserPreferences{
  return {...defaultPreferences,displayName:displayName?.trim()||'Student'};
}

export function StoreProvider({children}:{children:React.ReactNode}){
  const pathname=usePathname(),router=useRouter();
  const isPrivate=isPrivateRoute(pathname);
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [budgets,setBudgets]=useState<Budget[]>([]);
  const [loans,setLoans]=useState<Loan[]>([]);
  const [bills,setBills]=useState<RecurringBill[]>([]);
  const [sharedExpenses,setSharedExpenses]=useState<SharedExpense[]>([]);
  const [preferences,setPrefs]=useState(defaultPreferences);
  const prefRef=useRef(preferences);
  const [ready,setReady]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [email,setEmail]=useState('');
  const userId=useRef<string|null>(null);
  const snapshotRef=useRef<OfflineState|null>(null);
  const writes=useRef<Promise<void>>(Promise.resolve());
  const syncing=useRef(false);
  const syncRef=useRef<(()=>Promise<boolean>)|undefined>(undefined);
  const lastSyncError=useRef<string|null>(null);
  const [message,setMessage]=useState('');
  const [revision,setRevision]=useState(0);
  const [online,setOnline]=useState(()=>!Capacitor.isNativePlatform()&&typeof navigator!=='undefined'?navigator.onLine:false);
  const onlineRef=useRef(online);
  const toast=(s:string)=>setMessage(s);

  const publish=useCallback((snapshot:OfflineState)=>{
    snapshotRef.current=snapshot;
    setTransactions(snapshot.transactions);
    setBudgets(snapshot.budgets);
    setLoans(snapshot.loans||[]);
    setBills(snapshot.bills||[]);
    setSharedExpenses(snapshot.sharedExpenses||[]);
    prefRef.current=snapshot.preferences;
    setPrefs(snapshot.preferences);
    setTimeZone(snapshot.preferences.timezone);
  },[]);

  const commitLocal=useCallback((update:(current:OfflineState)=>OfflineState)=>{
    const operation=writes.current.then(async()=>{
      const current=snapshotRef.current;
      if(!current)throw new Error('Your local account is not ready yet.');
      const next=update(current);
      await writeOfflineState(next);
      publish(next);
    });
    writes.current=operation.catch(()=>undefined);
    return operation;
  },[publish]);

  const synchronize=useCallback(async():Promise<boolean>=>{
    const accountId=userId.current;
    if(!onlineRef.current||!accountId||syncing.current)return false;
    syncing.current=true;
    try{
      while(onlineRef.current){
        const change=snapshotRef.current?.pending[0];
        if(!change)break;
        if(change.userId!==accountId)throw new Error('Pending offline changes belong to a different account.');
        await api.syncPendingChange(change);
        if(userId.current!==accountId)return false;
        await commitLocal(current=>({...current,pending:current.pending.filter(item=>item.id!==change.id)}));
      }
      if(!onlineRef.current||userId.current!==accountId||snapshotRef.current?.pending.length)return false;
      const [remoteTransactions,remoteBudgets,remoteLoans,remoteBills,remoteSharedExpenses,remotePreferences]=await Promise.all([
        api.fetchTransactions(),api.fetchBudgets(),api.fetchLoans(),api.fetchBills(),api.fetchSharedExpenses(),api.fetchProfile(),
      ]);
      if(!onlineRef.current||userId.current!==accountId)return false;
      await commitLocal(current=>applyPendingChanges({
        ...current,
        transactions:remoteTransactions,
        budgets:remoteBudgets,
        loans:remoteLoans,
        bills:remoteBills,
        sharedExpenses:remoteSharedExpenses,
        preferences:remotePreferences,
      },current.pending));
      lastSyncError.current=null;
      return true;
    }catch(error){
      if(onlineRef.current&&userId.current===accountId&&!isConnectionError(error)){
        const syncMessage='Some changes are saved on this device but could not sync. Check your account and try again.';
        if(lastSyncError.current!==syncMessage)setMessage(syncMessage);
        lastSyncError.current=syncMessage;
      }
      return false;
    }finally{
      syncing.current=false;
    }
  },[commitLocal]);
  syncRef.current=synchronize;
  const refresh=useCallback(async()=>{
    if(!onlineRef.current)return false;
    return await syncRef.current?.()??false;
  },[]);

  const enqueue=useCallback(async(change:PendingChangeInput)=>{
    const accountId=userId.current;
    if(!accountId)throw new Error('Your account is not ready to save offline changes.');
    const scopedChange:PendingChange={...change,userId:accountId};
    await commitLocal(current=>queuePendingChange(current,scopedChange));
    if(onlineRef.current)void syncRef.current?.();
  },[commitLocal]);

  useEffect(()=>{
    let active=true;
    const update=(connected:boolean)=>{
      onlineRef.current=connected;
      if(active)setOnline(connected);
    };
    const handleOnline=()=>update(true);
    const handleOffline=()=>update(false);
    if(Capacitor.isNativePlatform()){
      void Network.getStatus().then(({connected})=>update(connected)).catch(error=>console.error('Could not read Android network status.',error));
      let listener:PluginListenerHandle|undefined;
      let appListener:PluginListenerHandle|undefined;
      void Network.addListener('networkStatusChange',({connected})=>update(connected)).then(value=>{
        listener=value;
        if(!active)void listener.remove();
      }).catch(error=>console.error('Could not monitor Android network status.',error));
      void App.addListener('appStateChange',({isActive})=>{if(isActive)void syncRef.current?.()}).then(value=>{
        appListener=value;
        if(!active)void appListener.remove();
      }).catch(error=>console.error('Could not monitor Android app state.',error));
      const retry=setInterval(()=>{if(snapshotRef.current?.pending.length)void syncRef.current?.()},30000);
      return()=>{active=false;clearInterval(retry);void listener?.remove();void appListener?.remove()};
    }
    window.addEventListener('online',handleOnline);
    window.addEventListener('offline',handleOffline);
    update(navigator.onLine);
    const retry=setInterval(()=>{if(snapshotRef.current?.pending.length)void syncRef.current?.()},30000);
    return()=>{
      active=false;
      clearInterval(retry);
      window.removeEventListener('online',handleOnline);
      window.removeEventListener('offline',handleOffline);
    };
  },[]);

  useEffect(()=>{
    if(!isPrivate)return;
    let active=true;
    setReady(false);
    setLoadError('');
    let client:ReturnType<typeof browserClient>;
    try{client=browserClient()}catch(error){
      setLoadError(error instanceof Error?error.message:'Supabase is not configured.');
      setReady(true);
      return;
    }
    async function activateAccount(accountId:string,cachedState:OfflineState|undefined,session?:Awaited<ReturnType<typeof client.auth.getSession>>['data']['session']){
      userId.current=accountId;
      if(session?.user){
        rememberOfflineAccount(accountId);
        setEmail(session.user.email||'');
      }
      const cached=cachedState?.userId===accountId?cachedState:await readOfflineState(accountId);
      if(!active)return;
      const storedSnapshot:OfflineState=cached?{...cached,loans:cached.loans||[],bills:cached.bills||[],sharedExpenses:cached.sharedExpenses||[],pending:cached.pending||[]}:{
        userId:accountId,
        transactions:[],
        budgets:[],
        loans:[],
        bills:[],
        sharedExpenses:[],
        preferences:initialPreferences(
          session?.user?.user_metadata?.full_name||session?.user?.user_metadata?.name,
        ),
        pending:[],
      };
      const snapshot=applyPendingChanges(storedSnapshot,storedSnapshot.pending);
      snapshotRef.current=snapshot;
      await writeOfflineState(snapshot);
      if(!active)return;
      publish(snapshot);
      setReady(true);
      if(onlineRef.current)void syncRef.current?.();
    }
    void (async()=>{
      let connected=onlineRef.current;
      if(Capacitor.isNativePlatform()){
        try{connected=(await Network.getStatus()).connected}
        catch(error){console.error('Could not read Android network status during startup.',error);connected=true}
      }else connected=navigator.onLine;
      onlineRef.current=connected;
      if(active)setOnline(connected);
      const rememberedId=getRememberedOfflineAccount();
      const cachedState=rememberedId?await readOfflineState(rememberedId):undefined;
      if(!connected&&rememberedId&&cachedState){
        await activateAccount(rememberedId,cachedState);
        return;
      }
      const {data,error}=await withSessionTimeout(client.auth.getSession());
      if(!active)return;
      const session=data.session;
      const offlineAccountId=!session?.user&&canRestoreOfflineSession(
        Boolean(cachedState),
        connected,
        error,
      )?rememberedId:null;
      if((error||!session?.user)&&!offlineAccountId){
        setTransactions([]);
        setBudgets([]);
        setLoans([]);
        setBills([]);
        setSharedExpenses([]);
        router.replace(privateRouteLoginHref(pathname));
        router.refresh();
        return;
      }
      const accountId=session?.user.id||offlineAccountId;
      if(!accountId){
        router.replace(privateRouteLoginHref(pathname));
        router.refresh();
        return;
      }
      await activateAccount(accountId,cachedState,session);
    })().catch(async error=>{
      if(active){
        try{
          const rememberedId=getRememberedOfflineAccount();
          const cachedState=rememberedId?await readOfflineState(rememberedId):undefined;
          if(rememberedId&&canRestoreOfflineSession(Boolean(cachedState),onlineRef.current,error)){
            await activateAccount(rememberedId,cachedState);
            return;
          }
          setLoadError(error instanceof Error?error.message:'Could not restore your local session.');
          setReady(true);
        }catch(storageError){
          if(active){
            setLoadError(storageError instanceof Error?storageError.message:'Could not access local offline storage.');
            setReady(true);
          }
        }
      }
    });
    const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
      if(session?.user&&(event==='USER_UPDATED'||event==='TOKEN_REFRESHED'))setEmail(session.user.email||'');
      if(event==='SIGNED_IN'&&session?.user.id&&userId.current&&session.user.id!==userId.current){
        userId.current=null;
        snapshotRef.current=null;
        setTransactions([]);
        setBudgets([]);
        setLoans([]);
        setBills([]);
        setSharedExpenses([]);
        rememberOfflineAccount(session.user.id);
        setRevision(value=>value+1);
      }
      if(event==='SIGNED_OUT'){
        userId.current=null;
        snapshotRef.current=null;
        clearRememberedOfflineAccount();
        setTransactions([]);
        setBudgets([]);
        setLoans([]);
        setBills([]);
        setSharedExpenses([]);
        router.replace('/login?reason=session');
        router.refresh();
      }
    });
    return()=>{active=false;subscription.unsubscribe()};
  },[isPrivate,revision,router,pathname,publish]);

  useEffect(()=>{
    if(online&&userId.current)void syncRef.current?.();
  },[online,revision,ready]);

  useEffect(()=>{
    const accountId=userId.current;
    if(!ready||!online||!accountId)return;
    const client=browserClient();
    let refreshTimer:ReturnType<typeof setTimeout>|undefined;
    const refreshOnChange=()=>{
      if(refreshTimer)clearTimeout(refreshTimer);
      refreshTimer=setTimeout(()=>{void syncRef.current?.()},150);
    };
    const channel=client.channel(`spendwise-account-${accountId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'transactions',filter:`user_id=eq.${accountId}`},refreshOnChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'budgets',filter:`user_id=eq.${accountId}`},refreshOnChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'loans',filter:`user_id=eq.${accountId}`},refreshOnChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'recurring_bills',filter:`user_id=eq.${accountId}`},refreshOnChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'shared_expenses',filter:`user_id=eq.${accountId}`},refreshOnChange)
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`id=eq.${accountId}`},refreshOnChange)
      .subscribe(status=>{
        if(status==='CHANNEL_ERROR')setMessage('Live sync could not connect. Use refresh to fetch the latest data.');
      });
    return()=>{
      if(refreshTimer)clearTimeout(refreshTimer);
      void client.removeChannel(channel);
    };
  },[online,revision,ready]);

  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{document.documentElement.dataset.theme=preferences.theme==='system'?(media.matches?'dark':'light'):preferences.theme};
    apply();
    if(preferences.theme!=='system')return;
    media.addEventListener('change',apply);
    return()=>media.removeEventListener('change',apply);
  },[preferences.theme]);

  useEffect(()=>{
    if(!message)return;
    const timer=setTimeout(()=>setMessage(''),4500);
    return()=>clearTimeout(timer);
  },[message]);

  const setPreferences:React.Dispatch<React.SetStateAction<UserPreferences>>=useCallback(action=>{
    const notificationsWereEnabled=prefRef.current.notifications;
    const next=typeof action==='function'?action(prefRef.current):action;
    prefRef.current=next;
    setPrefs(next);
    setTimeZone(next.timezone);
    if(!userId.current)return;
    if(notificationsWereEnabled!==next.notifications&&snapshotRef.current){
      const {loans=[],bills=[]}=snapshotRef.current;
      const updates=[
        ...loans.map(item=>next.notifications&&item.remaining>0&&localReminderTime(item.dueDate)
          ?scheduleReminder('loan',item.id,`${item.direction==='repay'?'Loan payment to':'Repayment from'} ${item.person}`,item.dueDate,true)
          :cancelReminder('loan',item.id)),
        ...bills.map(item=>next.notifications&&item.reminder&&localReminderTime(item.nextDue)
          ?scheduleReminder('bill',item.id,item.name,item.nextDue,true)
          :cancelReminder('bill',item.id)),
      ];
      void Promise.all(updates).then(results=>{
        if(next.notifications&&results.some(result=>result===false))setMessage('Some reminders could not be scheduled. Check notification permission and upcoming due dates.');
      }).catch(error=>setMessage(error instanceof Error?`Could not update reminders: ${error.message}`:'Could not update reminders on this device.'));
    }
    void enqueue({id:crypto.randomUUID(),type:'profile.save',value:next}).catch(error=>{
      if(prefRef.current===next&&snapshotRef.current){
        prefRef.current=snapshotRef.current.preferences;
        setPrefs(snapshotRef.current.preferences);
        setTimeZone(snapshotRef.current.preferences.timezone);
      }
      setMessage(error instanceof Error?error.message:'Could not save your settings on this device.');
    });
  },[enqueue]);

  async function saveTransaction(transaction:Transaction,_edit:boolean){
    await enqueue({id:crypto.randomUUID(),type:'transaction.save',value:transaction});
  }
  async function removeTransaction(id:string){
    await enqueue({id:crypto.randomUUID(),type:'transaction.delete',value:id});
  }
  async function saveBudget(budget:Budget,_edit:boolean){
    await enqueue({id:crypto.randomUUID(),type:'budget.save',value:{...budget,createdAt:budget.createdAt||new Date().toISOString()}});
  }
  async function removeBudget(id:string){
    await enqueue({id:crypto.randomUUID(),type:'budget.delete',value:id});
  }
  async function saveLoan(loan:Loan){await enqueue({id:crypto.randomUUID(),type:'loan.save',value:loan})}
  async function payLoan(loan:Loan,transaction:Transaction){
    const accountId=userId.current;
    if(!accountId)throw new Error('Your account is not ready to save offline changes.');
    const changes:PendingChange[]=[
      {id:crypto.randomUUID(),userId:accountId,type:'loan.save',value:loan},
      {id:crypto.randomUUID(),userId:accountId,type:'transaction.save',value:transaction},
    ];
    await commitLocal(current=>changes.reduce(queuePendingChange,current));
    if(onlineRef.current)void syncRef.current?.();
  }
  async function removeLoan(id:string){await enqueue({id:crypto.randomUUID(),type:'loan.delete',value:id})}
  async function saveBill(bill:RecurringBill){await enqueue({id:crypto.randomUUID(),type:'bill.save',value:bill})}
  async function removeBill(id:string){await enqueue({id:crypto.randomUUID(),type:'bill.delete',value:id})}
  async function payBill(bill:RecurringBill,transaction:Transaction){
    const accountId=userId.current;
    if(!accountId)throw new Error('Your account is not ready to save offline changes.');
    const changes:PendingChange[]=[
      {id:crypto.randomUUID(),userId:accountId,type:'bill.save',value:bill},
      {id:crypto.randomUUID(),userId:accountId,type:'transaction.save',value:transaction},
    ];
    await commitLocal(current=>changes.reduce(queuePendingChange,current));
    if(onlineRef.current)void syncRef.current?.();
  }
  async function saveSharedExpense(expense:SharedExpense){await enqueue({id:crypto.randomUUID(),type:'sharedExpense.save',value:expense})}
  async function removeSharedExpense(id:string){await enqueue({id:crypto.randomUUID(),type:'sharedExpense.delete',value:id})}
  async function restoreBackup(data:BackupData){
    const accountId=userId.current;
    if(!accountId||data.userId!==accountId)throw new Error('This backup belongs to a different SpendWise account.');
    const current=snapshotRef.current;
    if(!current)throw new Error('Your local account is not ready to restore a backup.');
    const additions=[
      ...data.loans.filter(item=>!(current.loans||[]).some(existing=>existing.id===item.id)).map(value=>({id:crypto.randomUUID(),userId:accountId,type:'loan.save' as const,value})),
      ...data.transactions.filter(item=>!current.transactions.some(existing=>existing.id===item.id)).map(value=>({id:crypto.randomUUID(),userId:accountId,type:'transaction.save' as const,value})),
      ...data.budgets.filter(item=>!current.budgets.some(existing=>existing.id===item.id)).map(value=>({id:crypto.randomUUID(),userId:accountId,type:'budget.save' as const,value})),
      ...data.bills.filter(item=>!(current.bills||[]).some(existing=>existing.id===item.id)).map(value=>({id:crypto.randomUUID(),userId:accountId,type:'bill.save' as const,value})),
      ...data.sharedExpenses.filter(item=>!(current.sharedExpenses||[]).some(existing=>existing.id===item.id)).map(value=>({id:crypto.randomUUID(),userId:accountId,type:'sharedExpense.save' as const,value})),
    ];
    await commitLocal(state=>additions.reduce(queuePendingChange,state));
    if(onlineRef.current)void syncRef.current?.();
    return additions.length;
  }
  async function signOut(){
    const {error}=await browserClient().auth.signOut();
    if(error)throw error;
    clearRememberedOfflineAccount();
    userId.current=null;
    snapshotRef.current=null;
    setTransactions([]);
    setBudgets([]);
    setLoans([]);
    setBills([]);
    setSharedExpenses([]);
    router.replace('/login');
    router.refresh();
  }

  return <Context.Provider value={{
    transactions,budgets,loans,bills,sharedExpenses,preferences,setPreferences,ready,loadError,
    reload:()=>setRevision(value=>value+1),refresh,email,
    saveTransaction,removeTransaction,saveBudget,removeBudget,saveLoan,payLoan,removeLoan,saveBill,removeBill,payBill,
    saveSharedExpense,removeSharedExpense,restoreBackup,accountId:userId.current||'',signOut,toast,
  }}>{children}{message&&<div role="status" className="toast">{message}</div>}</Context.Provider>;
}

export function useStore(){
  const store=useContext(Context);
  if(!store)throw Error('Missing store');
  return store;
}
