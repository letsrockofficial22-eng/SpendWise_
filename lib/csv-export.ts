import {Capacitor} from '@capacitor/core';
import {Directory,Encoding,Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Transaction} from '../types';

export async function exportCSV(items:Transaction[]){
  const rows=[['Date','Type','Category','Subcategory','Description','Payment method','Amount (BDT)','Notes'],...items.map(t=>[t.date,t.type,t.category,t.subcategory||'',t.description||'',t.paymentMethod,String(t.amount),t.notes||''])];
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')}"`).join(',')).join('\n');

  if(Capacitor.isNativePlatform()){
    try{
      const {uri}=await Filesystem.writeFile({path:'spendwise-transactions.csv',data:csv,directory:Directory.Cache,encoding:Encoding.UTF8});
      await Share.share({title:'SpendWise transactions',text:'Transactions exported from SpendWise.',files:[uri],dialogTitle:'Export transactions'});
    }catch(error){
      console.error('Could not export transactions from SpendWise.',error);
      window.alert('Could not export transactions. Please try again.');
    }
    return;
  }

  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');
  a.href=url;
  a.download='spendwise-transactions.csv';
  a.click();
  URL.revokeObjectURL(url);
}
