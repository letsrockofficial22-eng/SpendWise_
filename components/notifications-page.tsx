'use client';

import {useCallback,useEffect,useState} from 'react';
import {Bell,Check,RefreshCw} from 'lucide-react';
import {browserClient} from '../lib/supabase/client';

type NotificationRow={id:string;kind:'budget_alert'|'bill_due'|'sync_error';title:string;body:string;read_at:string|null;created_at:string};

export function NotificationsPage(){
  const [items,setItems]=useState<NotificationRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);

  const load=useCallback(async()=>{
    setError('');
    const {data,error}=await browserClient().from('notifications').select('id,kind,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(100);
    if(error){setError('Could not load notifications. Check your connection and try again.');return}
    setItems(data as NotificationRow[]);
  },[]);

  useEffect(()=>{
    let active=true;
    const client=browserClient();
    void client.from('notifications').select('id,kind,title,body,read_at,created_at').order('created_at',{ascending:false}).limit(100).then(({data,error})=>{
      if(!active)return;
      if(error)setError('Could not load notifications. Check your connection and try again.');
      else setItems(data as NotificationRow[]);
      setLoading(false);
    });
    const channel=client.channel('spendwise-notifications')
      .on('postgres_changes',{event:'*',schema:'public',table:'notifications'},()=>{if(active)void load()})
      .subscribe(status=>{if(status==='CHANNEL_ERROR'&&active)setError('Live notification updates are unavailable. Use refresh to check again.')});
    return()=>{active=false;void client.removeChannel(channel)};
  },[load]);

  async function markRead(item:NotificationRow){
    if(item.read_at)return;
    setBusy(true);setError('');
    const readAt=new Date().toISOString();
    const {error}=await browserClient().from('notifications').update({read_at:readAt}).eq('id',item.id);
    if(error)setError('Could not update this notification.');
    else setItems(current=>current.map(value=>value.id===item.id?{...value,read_at:readAt}:value));
    setBusy(false);
  }

  async function markAllRead(){
    const unread=items.filter(item=>!item.read_at);
    if(!unread.length||busy)return;
    setBusy(true);setError('');
    const readAt=new Date().toISOString();
    const {error}=await browserClient().from('notifications').update({read_at:readAt}).is('read_at',null);
    if(error)setError('Could not mark notifications as read.');
    else setItems(current=>current.map(item=>item.read_at?item:{...item,read_at:readAt}));
    setBusy(false);
  }

  const unreadCount=items.filter(item=>!item.read_at).length;
  return <><div className="page-heading"><div><div className="greeting">STAY IN THE LOOP</div><h1>Notifications</h1><p>Your budget updates and account activity.</p></div><div className="heading-actions"><button className="button outline" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button>{unreadCount>0&&<button className="button" onClick={()=>void markAllRead()} disabled={busy}><Check size={16}/> Mark all read</button>}</div></div><section className="card notifications-card" aria-live="polite">{error&&<p role="alert" className="error">{error}</p>}{loading?<p>Loading notifications…</p>:items.length?items.map(item=><article className={`notification-item ${item.read_at?'read':'unread'}`} key={item.id}><div className="notification-empty-icon"><Bell size={18}/></div><div className="notification-item-copy"><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>{!item.read_at&&<button className="button outline small" onClick={()=>void markRead(item)} disabled={busy}>Mark read</button>}</article>):<div className="notification-empty"><div className="notification-empty-icon"><Bell size={22}/></div><h2>No notifications yet</h2><p>Budget threshold alerts will appear here when your spending reaches a budget limit.</p></div>}</section></>;
}
