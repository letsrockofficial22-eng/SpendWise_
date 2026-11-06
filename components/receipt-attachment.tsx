'use client';

import {useRef,useState} from 'react';
import {ExternalLink,Upload} from 'lucide-react';
import type {Transaction} from '../types';
import {browserClient} from '../lib/supabase/client';
import {useStore} from './store';

const bucket='receipts';
const extensions:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
const maxSize=5*1024*1024;

export function ReceiptAttachment({transaction}:{transaction:Transaction}){
  const {accountId,saveTransaction,toast}=useStore();
  const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false);

  async function attach(file?:File){
    if(!file)return;
    if(!extensions[file.type]){toast('Choose a JPG, PNG, WebP image, or PDF receipt.');return}
    if(file.size===0||file.size>maxSize){toast('Receipt files must be larger than 0 bytes and 5 MB or smaller.');return}
    if(!accountId){toast('Your account is not ready to attach a receipt.');return}
    setBusy(true);
    const client=browserClient();
    const path=`${accountId}/${transaction.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    try{
      const {error:uploadError}=await client.storage.from(bucket).upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError)throw uploadError;
      try{
        await saveTransaction({...transaction,receiptPath:path},true);
      }catch(error){
        const {error:removeError}=await client.storage.from(bucket).remove([path]);
        if(removeError)throw new Error(`Could not save the receipt link, and its uploaded file could not be removed: ${removeError.message}`);
        throw error;
      }
      if(transaction.receiptPath){
        const {error:removeError}=await client.storage.from(bucket).remove([transaction.receiptPath]);
        if(removeError)toast(`Receipt attached, but the previous file could not be removed: ${removeError.message}`);
        else toast('Receipt attached to transaction.');
      }else toast('Receipt attached to transaction.');
    }catch(error){
      toast(error instanceof Error?`Could not attach receipt: ${error.message}`:'Could not attach receipt.');
    }finally{
      setBusy(false);
      if(input.current)input.current.value='';
    }
  }

  async function openReceipt(){
    if(!transaction.receiptPath)return;
    setBusy(true);
    try{
      const {data,error}=await browserClient().storage.from(bucket).createSignedUrl(transaction.receiptPath,60);
      if(error)throw error;
      const link=document.createElement('a');
      link.href=data.signedUrl;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.click();
    }catch(error){
      toast(error instanceof Error?`Could not open receipt: ${error.message}`:'Could not open receipt.');
    }finally{
      setBusy(false);
    }
  }

  return <><input ref={input} className="visually-hidden" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={event=>void attach(event.target.files?.[0])}/>{transaction.receiptPath?<button aria-label="View receipt" title="View receipt" disabled={busy} onClick={()=>void openReceipt()}><ExternalLink size={15}/></button>:<button aria-label="Attach receipt" title="Attach receipt" disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/></button>}</>;
}
